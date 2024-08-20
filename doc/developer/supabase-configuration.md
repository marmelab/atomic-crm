# Configuring Supabase

Atomic CRM uses Supabase as a backend. This document explains how to configure a remote Supabase instance hosted at [supabase.com](https://supabase.com/).

## Creating a Remote Supabase Instance

Atomic CRM comes with a CLI utility to create a backend instance on [supabase.com](https://supabase.com/):

```sh
make supabase-remote-init
```

The script will ask you for the Supabase instance name, create the database, apply the migrations and deploy the edge functions. Finally, it will create a `.env.production.local` file with your remote Supabase configuration.

## Alternative: Using An Existing Supabase Instance

If you already created a project on [supabase.com](https://supabase.com/), you can configure the Atomic CRM frontend to use it.

First, log into your Supabase account:

```sh
npx supabase login
```

Now, link the local project to the Supabase instance. You'll be asked to enter the database password.

```sh
npx supabase link --project-ref ********************
```

Then, apply the migrations and deploy the edge functions:

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

Before deploying the frontend code to production, you may want to test the local frontend code when connected to the remote Supabase instance.

To do so, call the following command:

```sh
make prod-start
```

Using a remote Supabase instance can be interesting if you deploy from your computer, or if you want to test your app with production data in production mode.

## Setting The Login Callback

Atomic CRM uses Supabase's authentication system. When a user logs in, Supabase redirects them to an authentication callback URL that is handled by the frontend.

When developing with a local Supabase instance, the callback URL is already configured--you don't need to do anything.

When using a remote Supabase instance, you need to configure the callback URL as follows:

1. Go to the project dashboard at [supabase.com](https://supabase.com/).
2. Go to **Authentication** > **URL Configuration**.
3. Set up the callback URL of the production frontend in the **Site URL** field.

If you host Atomic CRM under the `https://example.com/atomic-crm/` URL, the callback URL should be `https://example.com/atomic-crm/auth-callback.html`.

## Customizing Email Templates

Atomic CRM uses Supabase to send authentication-related emails (confirm signup, reset password, etc).

When developing with a local Supabase instance, you test your custom mail templates via the [supabase TOML config](../../supabase/config.toml) file. An example of a custom template has been done for the [recovery](../../supabase/templates/recovery.html) email. Note that you will need to restart your supabase instance to apply the changes.

When using a remote Supabase instance, you can configure the email templates as follows:

1. Go to the project dashboard at [supabase.com](https://supabase.com/).
2. Go to **Authentication** > **Email Templates**.
3. Choose the template you want to change using the email template tabs.
4. Paste the template source code in the editor and save.

If you want more information on how to customize email templates, check the [Customizing Email Templates](https://supabase.com/docs/guides/cli/customizing-email-templates) documentation.

## Frequently Asked Questions

**I have a *Security Definer View* error in *Security Advisor***

This warning informs you that the `init_state` state view is public and can be called by everybody.

This view is required to test if the CRM has been setup correctly. It doesn't expose any data, so you can ignore the Security Advisor error. 
