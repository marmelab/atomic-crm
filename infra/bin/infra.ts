#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { ArdleyCrmDevStack } from "../lib/ardley-crm-dev-stack";

const app = new cdk.App();

new ArdleyCrmDevStack(app, "ArdleyCrmDevStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
  description: "DEV Woodley CRM — crm.dev.ardley.us",
});
