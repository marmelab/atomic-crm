#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { ArdleyCrmDevStack } from "../lib/ardley-crm-dev-stack";

const account = process.env.CDK_DEFAULT_ACCOUNT;
if (!account) {
  throw new Error(
    "CDK_DEFAULT_ACCOUNT is required (GitHub Actions secret, or export it locally).",
  );
}

const app = new cdk.App();

new ArdleyCrmDevStack(app, "ArdleyCrmDevStack", {
  env: {
    account,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
  description: "DEV Woodley CRM — crm.dev.ardley.us",
});
