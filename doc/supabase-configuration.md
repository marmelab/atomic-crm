# Supabase Configuration

## Remote Instance Setup

You can create a remote supabase using the following script:
```sh
make supabase-remote-init
```

The script will prompt you for the project configuration and will apply migrations and deploy edge functions.


## Manual Remove Instance Link

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

## Login Callback

To configure the authentication URL, you can go to your project dashboard at [supabase.com](https://supabase.com/). Then go to **Authentication** > **URL Configuration**. You can set up you callbacl URL in the **Site URL** field.

## Fequently Asked Questions

- I have a **Security Definer View** error in **Security Advisor**

You can ignore this error. This warning informs you that the `init_state` state view is public and can be called by everybody.
This view is required to test if your CRM has been setup correctly. This view has been configured to avoid data leak.
