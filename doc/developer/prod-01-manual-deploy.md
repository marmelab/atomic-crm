# Deploying Manually to Production

## Supabase Configuration

This guide assumes you have already configured your Supabase instance. Id you did not, please have a look at the [dedicated configuration guide](./dev-01-supabase-configuration.md).

## Testing Production Mode

If you want to test you code locally using production mode and the remote Supabase instance, you can run the following command:

```sh
make prod-start
```

Note: It will apply migrations and deploy edge functions.

You can then access the app via [`http://localhost:3000/`](http://localhost:3000/).

## Deploying The Frontend

The frontend of the CRM is a Single-Page App that can be deployed to any CDN, or to GitHub Pages.

First, build the fontend bundle with:

```sh
make build
```

This will create a `dist` directory with the built application made of static HTML, CSS, and JS files.

Then, upload this directory to the CDN of your choice. If you want to deploy it to the `gh-pages` branch of the your repository, you can use the following command:

```sh
npm run ghpages:deploy
``` 

## Deploying Updates

If you've modified the code, run the following command to deploy a new version of your CRM:

```sh
make prod-deploy
```

It will apply migrations, deploy edge functions and push the built applications to the `gh-pages` branch.
