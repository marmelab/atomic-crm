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
```

## Deploying to Another Repository

If you want to deploy the static website to another repository, you can configure the following variable on you repository:
```bash
DEPLOY_REPO_URL=git@github.com:<org>/<repository>.git
```
