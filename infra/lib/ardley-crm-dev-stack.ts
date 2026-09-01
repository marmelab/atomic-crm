import * as path from "node:path";

import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2Authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as apigwv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as rds from "aws-cdk-lib/aws-rds";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as triggers from "aws-cdk-lib/triggers";
import { Construct } from "constructs";

/** Public hosted zone already in the account. */
const ZONE_NAME = "ardley.us";
const ZONE_ID = "Z05525842X4KMDBJ1JLNK";
const SPA_HOST = "crm.dev.ardley.us";
const API_HOST = "api.crm.dev.ardley.us";
const COGNITO_POOL_ID = "us-east-1_m3IX8Cc9L";
const COGNITO_DOMAIN = "ardley-app-users-dev";

export class ArdleyCrmDevStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, "Zone", {
      hostedZoneId: ZONE_ID,
      zoneName: ZONE_NAME,
    });

    const certificate = new acm.Certificate(this, "Cert", {
      domainName: SPA_HOST,
      subjectAlternativeNames: [API_HOST],
      validation: acm.CertificateValidation.fromDns(zone),
    });

    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 1,
      restrictDefaultSecurityGroup: true,
    });

    const db = new rds.DatabaseCluster(this, "Aurora", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_8,
      }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 2,
      writer: rds.ClusterInstance.serverlessV2("writer"),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      credentials: rds.Credentials.fromGeneratedSecret("ardley"),
      defaultDatabaseName: "ardley_crm",
      storageEncrypted: true,
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPool = cognito.UserPool.fromUserPoolId(
      this,
      "AppUsers",
      COGNITO_POOL_ID,
    );
    const userPoolClient = new cognito.UserPoolClient(this, "CrmClient", {
      userPool,
      userPoolClientName: "ardley-crm-dev",
      generateSecret: false,
      preventUserExistenceErrors: true,
      authFlows: {
        userSrp: true,
        userPassword: true,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          `https://${SPA_HOST}/auth/callback`,
          "http://localhost:5173/auth/callback",
        ],
        logoutUrls: [`https://${SPA_HOST}/`, "http://localhost:5173/"],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
    });

    const seedFn = new lambda.Function(this, "Seed", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      environment: {
        DB_SECRET_ARN: db.secret?.secretArn ?? "",
      },
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/seed")),
    });
    db.secret?.grantRead(seedFn);
    db.connections.allowDefaultPortFrom(seedFn);
    new triggers.Trigger(this, "SeedOnDeploy", {
      handler: seedFn,
      invocationType: triggers.InvocationType.EVENT,
      timeout: cdk.Duration.minutes(5),
    });

    const bff = new lambda.Function(this, "Bff", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "handler.handler",
      timeout: cdk.Duration.seconds(20),
      memorySize: 512,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      environment: {
        DB_SECRET_ARN: db.secret?.secretArn ?? "",
        COGNITO_ISSUER: `https://cognito-idp.us-east-1.amazonaws.com/${COGNITO_POOL_ID}`,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        SPA_ORIGIN: `https://${SPA_HOST}`,
      },
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/bff")),
    });
    db.secret?.grantRead(bff);
    db.connections.allowDefaultPortFrom(bff);

    const authorizer = new apigwv2Authorizers.HttpJwtAuthorizer(
      "CognitoJwt",
      `https://cognito-idp.us-east-1.amazonaws.com/${COGNITO_POOL_ID}`,
      {
        jwtAudience: [userPoolClient.userPoolClientId],
        identitySource: ["$request.header.Authorization"],
      },
    );

    const httpApi = new apigwv2.HttpApi(this, "Api", {
      apiName: "ardley-crm-dev",
      corsPreflight: {
        allowHeaders: ["content-type", "authorization"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.PATCH,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowOrigins: [`https://${SPA_HOST}`, "http://localhost:5173"],
      },
    });
    const bffIntegration = new apigwv2Integrations.HttpLambdaIntegration(
      "Bff",
      bff,
    );
    httpApi.addRoutes({
      path: "/health",
      methods: [apigwv2.HttpMethod.GET],
      integration: bffIntegration,
    });
    httpApi.addRoutes({
      path: "/{proxy+}",
      methods: [
        apigwv2.HttpMethod.GET,
        apigwv2.HttpMethod.PATCH,
        apigwv2.HttpMethod.POST,
      ],
      integration: bffIntegration,
      authorizer,
    });

    const apiDomain = new apigwv2.DomainName(this, "ApiDomain", {
      domainName: API_HOST,
      certificate,
    });
    new apigwv2.ApiMapping(this, "ApiMapping", {
      api: httpApi,
      domainName: apiDomain,
    });
    new route53.ARecord(this, "ApiAlias", {
      zone,
      recordName: API_HOST,
      target: route53.RecordTarget.fromAlias(
        new targets.ApiGatewayv2DomainProperties(
          apiDomain.regionalDomainName,
          apiDomain.regionalHostedZoneId,
        ),
      ),
    });

    const siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const distribution = new cloudfront.Distribution(this, "Spa", {
      defaultRootObject: "index.html",
      domainNames: [SPA_HOST],
      certificate,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: cdk.Duration.seconds(0),
        },
      ],
    });

    new s3deploy.BucketDeployment(this, "PlaceholderSite", {
      destinationBucket: siteBucket,
      distribution,
      sources: [s3deploy.Source.asset("./placeholder-site")],
    });

    new route53.ARecord(this, "SpaAlias", {
      zone,
      recordName: SPA_HOST,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution),
      ),
    });

    new cdk.CfnOutput(this, "SpaUrl", { value: `https://${SPA_HOST}` });
    new cdk.CfnOutput(this, "ApiUrl", { value: `https://${API_HOST}/health` });
    new cdk.CfnOutput(this, "DbSecretArn", {
      value: db.secret?.secretArn ?? "",
    });
    new cdk.CfnOutput(this, "VpcId", { value: vpc.vpcId });
    new cdk.CfnOutput(this, "CognitoClientId", {
      value: userPoolClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, "CognitoDomain", {
      value: `https://${COGNITO_DOMAIN}.auth.us-east-1.amazoncognito.com`,
    });
    new cdk.CfnOutput(this, "CognitoPoolId", { value: COGNITO_POOL_ID });
  }
}
