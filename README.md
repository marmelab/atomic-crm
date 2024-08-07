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
