# Atomic CRM

A full-feature CRM built with React and Supabase. 

https://user-images.githubusercontent.com/99944/116970434-4a926480-acb8-11eb-8ce2-0602c680e45e.mp4

You can test it online at https://marmelab.com/react-admin-crm.

## Local Supabase Setup

To run this project locally, you will need the following tools installed on your computer:

- Make
- Node 20 LTS
- Docker (required by Supabase)

Fork the [`marmelab/atomic-crm`](https://github.com/marmelab/atomic-crm) repository to your user/organization, then clone it locally:

```sh
git clone https://github.com/[username]/atomic-crm.git
```

Install dependencies:

```sh
cd atomic-crm
make install
```

This will install the dependencies for the frontend and the backend, including a local Supabase instance.

## Running the App In Development Mode

Start the app locally with the following command:

```sh
make start
```

This will start the Vite dev server for the frontend, the local Supabase instance for the API, and a Postgres database (thanks to Docker).

You can then access the app via [http://localhost:5173/](http://localhost:5173/).

## Testing

This project contains unit tests. Run them with the following command:

```sh
make test
```

## Deploying to Production

### Supabase Configuration

To configure Supabase, please have a look at [dedicated configuration guide](./doc/supabase-configuration.md).

### Testing Production Mode

If you want to test you code locally using production mode and the remote Supabase instance, you can run the following command:

```sh
make prod-start
```

Note: It will apply migrations and deploy edge functions.

You can then access the app via [`http://localhost:3000/`](http://localhost:3000/).

### Deploying The Frontend

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

### Deploying Updates

If you've modified the code, run the following command to deploy a new version of your CRM:

```sh
make prod-deploy
```

It will apply migrations, deploy edge functions and push the built applications to the `gh-pages` branch.

## GitHub Actions

Learn how to [configure GitHub Actions for Atomic CRM](./doc/github-actions.md).

## Customizing

You can customize the title, logo, theme, and domain of the CRM app by passing custom props to the `<CRM>` component:

```tsx
// App.tsx
import React from 'react';
import CRM from './CRM';

const App = () => (
    <CRM 
        title="Custom CRM Title" 
        logo="custom-logo.png" 
    />
);

export default App;
```

## Domain & Process

In addition to the design, you can easily customize various aspects relevant to your business domain. The behavior is the same as described above. You can modify the following:

| Props                 | Description                                                           | Type            |
|-----------------------|-----------------------------------------------------------------------|-----------------|
| contactGender         | The gender options for contacts used in the application.              | ContactGender[] |
| companySectors        | The list of company sectors used in the application.                  |  string[]       |
| darkTheme             | The theme to use when the application is in dark mode.                | RaThemeOptions  |
| dealCategories        | The categories of deals used in the application.                      | string[]        |
| dealPipelineStatuses  | The statuses of deals in the pipeline used in the application         | string[]        |
| dealStages            | The stages of deals used in the application.                          | DealStage[]     |
| lightTheme            | The theme to use when the application is in light mode.               | RaThemeOptions  |
| logo                  | The logo used in the CRM application.                                 | string          |
| noteStatuses          | The statuses of notes used in the application.                        | NoteStatus[]    |
| taskTypes             | The types of tasks used in the application.                           | string[]        |
| title                 | The title of the CRM application.                                     | string          |

```tsx
import { CRM } from './root/CRM';
import { ThemeOptions } from '@mui/material/styles';

const lightTheme: ThemeOptions = {
    palette: {
        mode: 'light',
    },
};

const darkTheme: ThemeOptions = {
    palette: {
        mode: 'dark',
    },
};

const App = () => {
    return (
        <CRM
            contactGender={[
                { value: 'male', label: 'He' },
                { value: 'female', label: 'She' },
            ]}
            companySectors={['Technology', 'Finance']}
            darkTheme={darkTheme}
            dealCategories={['Copywriting', 'Design']}
            dealPipelineStatuses={['won']}
            dealStages={[
                { value: 'opportunity', label: 'Opportunity' },
                { value: 'proposal-sent', label: 'Proposal Sent' },
                { value: 'won', label: 'Won' },
                { value: 'lost', label: 'Lost' },
            ]}
            lightTheme={lightTheme}
            logo="https://example.com/logo.png"
            noteStatuses={[
                { value: 'cold', label: 'Cold', color: '#7dbde8' },
                { value: 'warm', label: 'Warm', color: '#e8cb7d' },
                { value: 'hot', label: 'Hot', color: '#e88b7d' },
            ]}
            taskTypes={['Call', 'Email', 'Meeting']}
            title="CRM Dashboard"
        />
    );
};

export default App;
```

## Adding Sales

To add a new sale to the CRM, you need to use an administrator account. By default, the first account created has this role. If you are starting fresh, a sign-up page will prompt you to create this admin account.

When logged in as an admin, an 'Account Manager' tab will be available. From this page, you can create sales and transfer the administrator role.

![Adding sales](./public/img/adding-sales.png "Adding sales")


## Customizing the Homepage

The first page of the application is managed by the `Dashboard.tsx` component. You can customize it by updating this file.

```jsx
// ./src/dashboard/Dashboard.tsx
import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';

export const Dashboard = () => {
    return (
        <Card>
            <CardContent>
                <Typography variant="h5" component="div">
                    Welcome to the Custom Dashboard!
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    This is a customized homepage for your application. You can add any components or content here to suit your needs.
                </Typography>
            </CardContent>
        </Card>
    );
};
```

## Import Contacts

From the crm, a user can import a list of contacts via a csv file. This csv file must match the data you use to store your contacts. 
By default, we provide a sample file located at `./src/contacts/contacts_export.csv`.

If you change your data structure for a contact, don't forget to modify this sample. You'll also need to modify the import function found in `./src/contacts/useContactImport.tsx`

## Supabase

### Migrations

You can create a new migration using the following command:
```sh
npx supabase migration new <migration_name>
```

You can apply the migrations using the following command:
```sh
npx supabase migration up
```

But you can also apply changes in the database directly using the supabase Dashboard.
Create a new migration using the following command:
```sh
npx supabase db diff | npx supabase migration new <migration_name>
```

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
