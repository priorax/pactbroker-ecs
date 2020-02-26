#!/usr/bin/env babel-node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { PactStack } from '../lib/pact-stack';

const app = new cdk.App();
new PactStack(app, 'pactbroker');
