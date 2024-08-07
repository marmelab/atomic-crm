# Atomic CRM

This is a demo of the [react-admin](https://github.com/marmelab/react-admin) library for React.js. It's a CRM for a fake Web agency with a few sales. You can test it online at https://marmelab.com/react-admin-crm.

https://user-images.githubusercontent.com/99944/116970434-4a926480-acb8-11eb-8ce2-0602c680e45e.mp4

React-admin usually requires a REST/GraphQL server to provide data. In this demo however, the API is simulated by the browser (using [FakeRest](https://github.com/marmelab/FakeRest)). The source data is generated at runtime by a package called [data-generator](https://github.com/marmelab/react-admin/tree/master/examples/data-generator).

To explore the source code, start with [src/App.tsx](https://github.com/marmelab/react-admin/blob/master/examples/crm/src/App.tsx).


## Setup

To run this project you will need the following tools installed on your computer:
- Make
- Node 20 LTS
- NPM
- Docker (required by supabase)

After having cloned the [`atomic-crm` repository](https://github.com/marmelab/atomic-crm), run the following command at the project root to install dependencies:

```sh
make install
```

Then you can start the stack in development mode with the following command:
```sh
make start
```

It will start the vite dev server and the local supabase instance. You can then access the app via [`http://localhost:5173/`](http://localhost:5173/).


## Remote Instance Setup

You can create a remote supabase using the following script:
```sh
make supabase-remote-init
```

The script will prompt your for the project configuration and will apply migrations and deploy edge functions.


## Manual Remove Instance Link

If you already created the supabase instance, you can link the instance manually using the following commands:

First, login into your supabase account:

```sh
npx supabase login
```

Now, link this project to the local supabase instance. You'll be asked to enter the database password.
```sh
npx supabase link --project-ref ********************
```

Then, apply the migrations on it:
```sh
npx supabase db push
npx supabase functions deploy
```

Finally, create the `.env.production.local` file with your supabase configuration:

```sh
VITE_SUPABASE_URL=<instance_url>
VITE_SUPABASE_ANON_KEY=<instance_anon_token>
```

## Deploy Updates

If you want to deploy a new version of your CRM, you can run the following command:
```sh
make prod-deploy
```

It will apply migrations, deploy edge functions and push the built applications to the `gh-pages` branch.

## Test Production Mode

If you want to test you application in production mode using the remote supabase instance, you can run the following command:
```sh
make prod-start
```

Note: It will apply migrations and deploy edge functions.

You can then access the app via [`http://localhost:3000/`](http://localhost:3000/).


# GitHub Actions

This project supports github actions for continuous integration and delivery. To enable GitHub actions on this repo, you will
have to create the following secrets:

```bash
SUPABASE_ACCESS_TOKEN: Your personal access token, can be found at https://supabase.com/dashboard/account/tokens
SUPABASE_DB_PASSWORD: Your supabase database password
SUPABASE_PROJECT_ID: Your supabase project id
```

Also, you will need to configure the some variables:
```bash
VITE_APPLICATION_BASENAME: The base URL of your application, optional
VITE_IS_DEMO: Set to `true` if you want to display the demo banner
```

You will also need to configure the following environment variables to deploy to GH pages:
```bash
GIT_USER_NAME: The deploy account's name
GIT_USER_EMAIL: The deploy user's email
```

## Supabase

### Password Reset When Forgotten
If users forgot their password, they can request for a reset. Atomic CRM handle it for you. All the magic is done by the custom route `/forgot-password` and `/set-password` that you can find in the `CRM` component.

If you want to update default configuration: 

### Local development

1. Go to your `config.toml` file
2. In `[auth]` section set `site_url` to  your application URL
3. In `[auth]`, add the following URL in the `additional_redirect_urls = [{APPLICATION_URL}}/auth-callback"]`
4. Add an `[auth.email.template.recovery]` section with the following option
```
[auth.email.template.recovery]
subject = "Reset Password"
content_path = "./supabase/templates/recovery.html"
```

In Recovery email template set the `auth-callback` redirection

```HTML
<html>
  <body>
    <h2>Reset Password</h2>
    <p><a href="{{ .ConfirmationURL }}/auth-callback">Reset your password</a></p>
  </body>
</html>
```

Supabase provides an [Inbucket](https://inbucket.org/) instance that allows you to test your emails and configure your flow.

### Production

This requires you to configure your supabase instance:

1. Go to your dashboard Authentication section
2. In URL Configuration, set Site URL to your application URL
3. In URL Configuration, add the following URL in the Redirect URLs section: `YOUR_APPLICATION_URL/auth-callback`
4. In Email Templates, change the `"{{ .ConfirmationURL }}"` to `"{{ .ConfirmationURL }}/auth-callback"`