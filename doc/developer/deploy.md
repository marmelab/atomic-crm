# Deploying to Production Manually

## Deploying The Backend

The entire backend of Atomic CRM is hosted on Supabase. The backend is composed of a Postgres database, a REST API, and edge functions. Check out the [Supabase Configuration](./supabase-configuration.md) section for details.

After [configuring your Supabase instance](./supabase-configuration.md), you can deploy the backend changes with the following command:

```sh
make supabase-deploy
```

Make sure you access the frontend once to initialize the main admin account.

## Testing Production Mode

If you want to test you local frontend code using the remote Supabase instance and the production settings, you can run the following command:

```sh
make prod-start
```

Note: It will apply migrations and deploy edge functions.

You can then access the app via [`http://localhost:3000/`](http://localhost:3000/).

## Deploying The Frontend

The frontend of the CRM is a Single-Page App that can be deployed to any CDN, or to GitHub Pages.

First, build the frontend bundle with:

```sh
make build
```

This will create a `dist` directory with the built application made of static HTML, CSS, and JS files. Upload this directory to the CDN of your choice (e.g. Netlify, Vercel, etc.).

If you want to deploy it to GitHub pages, you can use the following command:

```sh
yarn run ghpages:deploy
```

The CRM will be available at `https://<username>.github.io/atomic-crm/`.

## Deploying Updates

If you've modified the code, run the following command to deploy a new version of your CRM:

```sh
make prod-deploy
```

It will apply migrations, deploy edge functions and push the built applications to the `gh-pages` branch.

## Automating Deployments With GitHub Actions

Atomic CRM contains GitHub actions for continuous integration and delivery. To enable these actions, you will
have to create the following secrets on GitHub:

```bash
SUPABASE_ACCESS_TOKEN: Your personal access token, can be found at https://supabase.com/dashboard/account/tokens
SUPABASE_DB_PASSWORD: Your supabase database password
SUPABASE_PROJECT_ID: Your supabase project id
SUPABASE_URL: Your supabase project URL
SUPABASE_ANON_KEY: Your supabase project anonymous key
POSTMARK_WEBHOOK_USER: User configured in Postmark to secure the webhook
POSTMARK_WEBHOOK_PASSWORD: Password configured in Postmark to secure the webhook
POSTMARK_WEBHOOK_AUTHORIZED_IPS: List of IPs (comma separated) authorized to send requests to the Postmark webhook
```

> **Note:** The `POSTMARK_*` variables are required for Atomic CRM's inbound email features. Have a look at the the [inbound email configuration](./inbound-email-configuration.md) to learn more about their usage and setup.

The GitHub action will run the `prod-deploy` command on every push to the `main` branch, deplyiong the frontend to GitHub pages and updating the Supabase instance.
