import * as ecs from '@aws-cdk/aws-ecs'
import * as ec2 from '@aws-cdk/aws-ec2'
import * as secrets from '@aws-cdk/aws-secretsmanager'
import * as deployment from '@aws-cdk/aws-ecs-patterns'
import { Certificate } from '@aws-cdk/aws-certificatemanager'
import { ApplicationProtocol } from '@aws-cdk/aws-elasticloadbalancingv2';
import { HostedZone } from '@aws-cdk/aws-route53';
import { Protocol, IVpc } from '@aws-cdk/aws-ec2'
import { RedirectProtocol } from '@aws-cdk/aws-s3';
import { Stack, Duration } from '@aws-cdk/core'
import {LogGroup, RetentionDays} from '@aws-cdk/aws-logs'
import { BuiltCluster } from './db'

export default function(scope: Stack, db: BuiltCluster, vpc: IVpc) {
    const logGroup = new LogGroup(scope, 'pactLogs', {
        logGroupName: `${scope.stackName.toLocaleLowerCase()}/ecs/pact`,
        retention: RetentionDays.ONE_MONTH
    })
    const pactTd = new ecs.FargateTaskDefinition(scope, 'pactBrokerTask', {
        family: 'pact',
        cpu: 512,
        memoryLimitMiB: 1024
    })
    const zone = new HostedZone(scope, 'dns', {
        zoneName: 'pact.dougferris.id.au'
    })
    const secret = new secrets.Secret(scope, 'pactCredentials', {
        generateSecretString: {
            passwordLength: 32,
            excludePunctuation: true
        },
        secretName: 'pact_write_account',
        description: 'Used to secure the pact database'
    })
    pactTd.addContainer('pact', {
        image: ecs.ContainerImage.fromRegistry('pactfoundation/pact-broker:2.49.0-1'),
        essential: true,
        environment: {
            PACT_BROKER_DATABASE_ADAPTER: 'mysql2',
            PACT_BROKER_DATABASE_PORT: db.cluster.attrEndpointPort,
            PACT_BROKER_DATABASE_NAME: 'pact',
            PACT_BROKER_DATABASE_HOST: db.cluster.attrEndpointAddress,
            PACT_BROKER_DATABASE_USERNAME: 'admin',
            PACT_BROKER_BASE_URL: `https://${zone.zoneName}`,
            PACT_BROKER_PUBLIC_HEARTBEAT: 'true',
            PACT_BROKER_LOG_LEVEL: 'DEBUG',
            PACT_BROKER_BASIC_AUTH_USERNAME: 'admin',
            PACT_BROKER_ALLOW_PUBLIC_READ: 'true'
        },
        secrets: {
            PACT_BROKER_BASIC_AUTH_PASSWORD: ecs.Secret.fromSecretsManager(secret),
            PACT_BROKER_DATABASE_PASSWORD: ecs.Secret.fromSecretsManager(db.secret)
        },
        logging: new ecs.AwsLogDriver({
            logGroup: logGroup,
            streamPrefix: 'pact'
        })
    }).addPortMappings({
        containerPort: 9292,
        protocol: ecs.Protocol.TCP
    })
    const cluster = new ecs.Cluster(scope, 'pact-cluster', {
        containerInsights: false,
        vpc: vpc
    })
    const cert = Certificate.fromCertificateArn(scope, 'cert', 'arn:aws:acm:ap-southeast-2:076927181780:certificate/56892a4a-fa07-458b-aeb1-803b8f7b2cc4')
    const service = new deployment.ApplicationLoadBalancedFargateService(scope, 'pactBroker', {
        enableECSManagedTags: true,
        cpu: 512,
        memoryLimitMiB: 1024,
        taskDefinition: pactTd,
        cluster: cluster,
        protocol: ApplicationProtocol.HTTPS,
        listenerPort: 443,
        domainName: 'pact.dougferris.id.au',
        domainZone: zone,
        certificate: cert,
        propagateTags: ecs.PropagatedTagSource.SERVICE,
        desiredCount: 1,
        healthCheckGracePeriod: Duration.seconds(120)
    })

    service.targetGroup.configureHealthCheck({
        path: '/diagnostic/status/heartbeat'
    })
    const http = service.loadBalancer.addListener('http', {
        port: 80
    })
    http.addRedirectResponse('httpsdammit', {
        host: 'pact.dougferris.id.au',
        port: '443',
        protocol: RedirectProtocol.HTTPS.toLocaleUpperCase(),
        statusCode: 'HTTP_302'
    })
    service.service.connections.allowTo(db.sg, new ec2.Port({ fromPort: 3306, toPort: 3306, protocol: Protocol.TCP, stringRepresentation: '' }), 'ECS Access')
}