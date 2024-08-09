# GitHub Actions

## Configuration

This project supports github actions for continuous integration and delivery. To enable GitHub actions on this repo, you will
have to create the following secrets:

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

> **Note:** The `POSTMARK_*` variables are required for Atomic CRM's email features. Have a look at the the [email features documentation](./email-features.md) to learn more about their usage and setup.

## Deploying to Another Repository

If you want to deploy the static website to another repository, you must first generete a personal access token [in the GitHub settings](https://github.com/settings/tokens?type=beta):

- Give a name to the token
- Set token expiration
- Select `Only select repositories`, and select the target repository
- On the repository permissions, select "Write Access" under "Contents"

Then you can configure the following GitHub action variable on you repository:
```bash
DEPLOY_REPOSITORY=<org>/<repository>
```

And finally, you must creat ethe following GitHub Action secret:

```bash
DEPLOY_TOKEN=<personal_access_token>
```

You can also configure the deploy branch using
```bash
DEPLOY_BRANCH=main # Defaults to `gh-pages`
```
