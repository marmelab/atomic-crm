# GitHub Actions

## Configuration

his project supports github actions for continuous integration and delivery. To enable GitHub actions on this repo, you will
have to create the following secrets:

```bash
SUPABASE_ACCESS_TOKEN: Your personal access token, can be found at https://supabase.com/dashboard/account/tokens
SUPABASE_DB_PASSWORD: Your supabase database password
SUPABASE_PROJECT_ID: Your supabase project id
SUPABASE_URL: Your supabase project URL
SUPABASE_ANON_KEY: Your supabase project anonymous key
```

Also, you will need to configure the some variables:
```bash
VITE_IS_DEMO: Set to `true` if you want to display the demo banner
```

## Deploying to Another Repository

If you want to deploy the static website to another repository, you can configure the following secret on you repository:
```bash
DEPLOY_REPO_URL=git@github.com:<org>/<repository>.git
```
