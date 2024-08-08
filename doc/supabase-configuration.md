# Supabase Configuration

## Link Remote Instance Locally

Local remote instance link can be interesting if you want to deploy from your development computer or if you want your app with production data in production mode.

### Creating a new remote Supabase Instance

You can create a remote supabase using the following script:
```sh
make supabase-remote-init
```

The script will prompt you for the project configuration and will apply migrations and deploy edge functions.


### Using An Existing Remote Supabase Instance

If you already created the supabase instance, you can link the instance manually using the following commands:
First, log into your supabase account:

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

This will allow your to use the linked supabase instance when running the following command to test the app in production mode locally:
```sh
make prod-start
```

## Continuous Integration and Continuous Delivery

This repository includes GitHub action worflow for Continuous Delivery. The configuration is explained in the [GitHub Actiosns guide](./github-actions.md) in the same directory.

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

## Fequently Asked Questions

- I have a **Security Definer View** error in **Security Advisor**

You can ignore this error. This warning informs you that the `init_state` state view is public and can be called by everybody.
This view is required to test if your CRM has been setup correctly. This view has been configured to avoid data leak.
