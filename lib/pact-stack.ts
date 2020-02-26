import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2'
import ecs from './ecs'
import dbcluster from './db'

export class PactStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    var vpc = new ec2.Vpc(this, 'vpc', {
      natGateways: 1,
      maxAzs: 2
    })
    const db = dbcluster(this, vpc, this.stackName)
    ecs(this, db, vpc)
  }
}
