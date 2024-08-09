# Supabase Configuration

### Creating a Remote Supabase Instance

You can create a remote Supabase using the following script:

```sh
make supabase-remote-init
```

The script will ask you for the Supabase instance name, create the database, apply the migrations and deploy the edge functions. Finally, it will create a `.env.production.local` file with your remote Supabase configuration.

### Alternative: Using An Existing Supabase Instance

If you already created a Supabase instance for Atomic CRM, you can link the instance manually as follows.

First, log into your Supabase account:

```sh
npx supabase login
```

Now, link this project to the local Supabase instance. You'll be asked to enter the database password.

```sh
npx supabase link --project-ref ********************
```

Then, apply the migrations on it:

```sh
npx supabase db push
npx supabase functions deploy
```

Finally, add a `.env.production.local` file in the root directory with your remote Supabase credentials:

```sh
VITE_SUPABASE_URL=<instance_url>
VITE_SUPABASE_ANON_KEY=<instance_anon_token>
```

## Testing Production Mode

Before deploying the frontend code to production, you should test the local frontend code when connected to the remote Supabase instance. 

To do so, call the following command:

```sh
make prod-start
```

Using a remote Supabase instance can be interesting if you deploy from your computer, or if you want to test your app with production data in production mode.

## Continuous Integration and Continuous Delivery

This repository includes GitHub action workflow for Continuous Delivery. The configuration is explained in the [GitHub Actiosns guide](./github-actions.md) in the same directory.

## Login Callback

### Local Supabase Instance

Go to your [local supabase config](../supabase/config.toml) file:
1. In `[auth]` section set `site_url` to your application URL
2. In `[auth]`, add the following URL in the `additional_redirect_urls = [<APPLICATION_URL>/auth-callback.html"]`

### Remote Supabase Instance

To configure the authentication URL, you can go to your project dashboard at [supabase.com](https://supabase.com/). Then go to **Authentication** > **URL Configuration**. You can set up you callback URL in the **Site URL** field.

## Customizing Mail Template

### Local Instance Templates

You can customize the mail templates via the [supabase config](../supabase/config.toml) file. An example of a custom template has been done for the [recovery](../supabase/templates/recovery.html) email.

Note: updating the templates requires to restart your supabase instance.

If you want more information on how to customize email templates, go to the [related supabase documentation](https://supabase.com/docs/guides/cli/customizing-email-templates).

### Linked Instance Templates

If you want to customize the production templates, you can go to your project dashboard at [supabase.com](https://supabase.com/). Then go to **Authentication** > **Email Templates**. You can the choose which template to change using the email template stabs.

## Email Features

Supabase requires additional configuration to enable Atomic CRM's email features. Have a look at the the [email features documentation](./email-features.md) to learn more about their usage and the required setup.

## Fequently Asked Questions

- I have a **Security Definer View** error in **Security Advisor**

You can ignore this error. This warning informs you that the `init_state` state view is public and can be called by everybody.
This view is required to test if your CRM has been setup correctly. This view has been configured to avoid data leak.
