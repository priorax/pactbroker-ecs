import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import Pact = require('../lib/pact-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new Pact.PactStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
