# Getting Started

This guide explains the fastest way to get started with Atomic CRM at no cost. You'll use a free [Supabase.com](https://supabase.com/) instance for the backend and [GitHub Pages](https://pages.github.com/) to host the frontend—both services offer generous free tiers that are perfect for getting started. For other deployment options, see the [Deployment](./developer/deploy.md) documentation.

## Requirements

You'll need the following:

- A GitHub account
- Git installed on your machine
- Node.js installed on your machine

## Getting a Local Copy

First, fork the Atomic CRM repository at [https://github.com/marmelab/atomic-crm](https://github.com/marmelab/atomic-crm) to your GitHub user or organization.

Your fork will be available at [https://github.com/<username>/atomic-crm](https://github.com/<username>/atomic-crm).

Then clone it locally by typing the following commands in your terminal, replacing `<username>` with your GitHub username:

```sh
git clone https://github.com/<username>/atomic-crm.git
```

## Installing Dependencies

Atomic CRM uses Node.js. To install the dependencies, run the following commands:

```sh
cd atomic-crm
npm install
```

The application is now ready to use, but it still needs a backend.

## Setting Up Supabase

Supabase provides a hosted backend solution that includes a PostgreSQL database, authentication, and file storage. To set up Supabase for Atomic CRM, follow these steps:

1. Create a Supabase account at [supabase.com](https://supabase.com/). You don't need to set up a paid plan—the free tier is sufficient for development and small projects.

2. Run the following commands to create a new Supabase project and configure it for Atomic CRM:

    ```sh
    npm run supabase:remote:init
    ```

    The script will prompt you for the Supabase instance name, and create the database. It will also create a `.env.production.local` file with your remote Supabase configuration.

3. Next, apply the migrations and deploy the edge functions:

    ```sh
    npx supabase db push
    npx supabase functions deploy
    ```

Now the backend is ready to use.

## Testing the Application

To test the connection to the remote Supabase instance locally, run the following command:

```sh
npm run dev --mode production
```

You can then access the application at [http://localhost:5173/](http://localhost:5173/). You will be prompted to create the first user.

If you need to debug the backend, you can access the following services:

- Supabase dashboard: [http://localhost:54323/](http://localhost:54323/)
- REST API: [http://127.0.0.1:54321](http://127.0.0.1:54321)
- Attachments storage: [http://localhost:54323/project/default/storage/buckets/attachments](http://localhost:54323/project/default/storage/buckets/attachments)
- Inbucket email testing service: [http://localhost:54324/](http://localhost:54324/)

## Deploying the Frontend to GitHub Pages

The frontend of the CRM is a Single-Page Application that can be deployed to any static server or CDN. Since you already have a GitHub account, you can use GitHub Pages to host it for free.

First, build the frontend bundle:

```sh
npm run build
```

This will create a `dist` directory containing the built application with static HTML, CSS, and JavaScript files.

To deploy to GitHub Pages, use the following command:

```sh
npm run ghpages:deploy
```

The CRM will be available at `https://<username>.github.io/atomic-crm/` and will remain connected to your Supabase backend.

That's it! Your CRM is now live on the internet, and you can start using it.

## Next Steps

Now that you have Atomic CRM up and running, you can:

- [Change the constants to customize the application](./developer/customizing.md)
- Set up a local Supabase instance for development
- Add custom fields and update the code accordingly
- Configure Supabase Auth providers (Google, GitHub, etc.)
- Deploy the frontend to Vercel or Netlify
- Configure a hosted Supabase instance for production
