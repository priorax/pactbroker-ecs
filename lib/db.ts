import * as rds from '@aws-cdk/aws-rds'
import { Construct, Fn} from '@aws-cdk/core'
import { Secret, ISecret } from '@aws-cdk/aws-secretsmanager'
import { IVpc, SecurityGroup, ISecurityGroup } from '@aws-cdk/aws-ec2'
import { CfnDBCluster } from '@aws-cdk/aws-rds'
export interface BuiltCluster{
    cluster: CfnDBCluster;
    secret: ISecret;
    sg: ISecurityGroup
}
export default function(scope: Construct, vpc: IVpc, stackName: string): BuiltCluster {
    const secret = new Secret(scope, 'secret', {
        generateSecretString: {
            passwordLength: 32,
            excludePunctuation: true
        },
        secretName: 'pact_database_password',
        description: 'Used to secure the pact database'
    })
    const dbSubnets = new rds.CfnDBSubnetGroup(scope, 'dbSubnets', {
        subnetIds: vpc.privateSubnets.map(x => x.subnetId),
        dbSubnetGroupDescription: 'pactdbsubnet',
        dbSubnetGroupName: `${stackName.toLocaleLowerCase()}_subnets`
    })
    const sg = new SecurityGroup(scope, 'rdsAccess', {
        allowAllOutbound: false,
        vpc: vpc,
        securityGroupName: 'pact_broker'
    })
    const cluster = new rds.CfnDBCluster(scope, 'db', {
        engine: 'aurora',
        engineMode: 'serverless',
        engineVersion: '5.6',
        backupRetentionPeriod: 5,
        masterUsername: 'admin',
        masterUserPassword: secret.secretValue.toString(),
        port: 3306,
        databaseName: 'pact',
        dbSubnetGroupName: Fn.ref('dbSubnets'),
        vpcSecurityGroupIds: [sg.securityGroupId],
        scalingConfiguration: {
            autoPause: true,
            minCapacity: 1,
            maxCapacity: 2,
            secondsUntilAutoPause: 1000
        }
    })
    cluster.addDependsOn(dbSubnets)
    return {
        cluster,
        secret,
        sg
    }
}