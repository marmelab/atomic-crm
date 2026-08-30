import * as cdk from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as apigwv2Integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as rds from "aws-cdk-lib/aws-rds";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";

/** Public hosted zone already in the account. */
const ZONE_NAME = "ardley.us";
const ZONE_ID = "Z05525842X4KMDBJ1JLNK";
const SPA_HOST = "crm.dev.ardley.us";
const API_HOST = "api.crm.dev.ardley.us";

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
        version: rds.AuroraPostgresEngineVersion.VER_16_6,
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

    const hello = new lambda.Function(this, "Hello", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromInline(
        [
          "exports.handler = async () => ({",
          '  statusCode: 200,',
          "  headers: {",
          "    'content-type': 'application/json',",
          "    'access-control-allow-origin': 'https://crm.dev.ardley.us',",
          "  },",
          "  body: JSON.stringify({ ok: true, service: 'ardley-crm', env: 'dev' }),",
          "});",
        ].join("\n"),
      ),
      timeout: cdk.Duration.seconds(10),
    });

    const httpApi = new apigwv2.HttpApi(this, "Api", {
      apiName: "ardley-crm-dev",
      corsPreflight: {
        allowHeaders: ["content-type", "authorization"],
        allowMethods: [apigwv2.CorsHttpMethod.GET, apigwv2.CorsHttpMethod.OPTIONS],
        allowOrigins: [`https://${SPA_HOST}`],
      },
    });
    httpApi.addRoutes({
      path: "/health",
      methods: [apigwv2.HttpMethod.GET],
      integration: new apigwv2Integrations.HttpLambdaIntegration(
        "Health",
        hello,
      ),
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
  }
}
