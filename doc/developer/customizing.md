# Customizing Atomic CRM

Developers can customize the Atomic CRM application to suit their business needs. Some of the customizations can be achieved via configuration on the `<CRM>` component, while others require changes to the source code.

## The `<CRM>` component

The entry point of the frontend application is the `src/App.tsx` file. By default, this file simply renders the `<CRM>` component, which is the root component of Atomic CRM.

```tsx
import { CRM } from './root/CRM';

const App = () => <CRM />;

export default App;
```

`<CRM>` accepts various props to customize the application domain and look and feel, so the `App.tsx` file is the best place to configure your CRM.

For instance, the following code snippet shows how to customize the CRM application title, logo, themes, and domain-specific data.

```tsx
import { CRM } from './root/CRM';
import { radiantLightTheme, radiantDarkTheme } from 'react-admin';

const App = () => (
    <CRM
        title="ACME CRM"
        logo="./img/logo.png" // The logo path is relative to the public directory
        lightTheme={radiantLightTheme}
        darkTheme={radiantDarkTheme}
        contactGender={[
            { value: 'male', label: 'He' },
            { value: 'female', label: 'She' },
        ]}
        companySectors={['Technology', 'Finance']}
        dealCategories={['Copywriting', 'Design']}
        dealPipelineStatuses={['won']}
        dealStages={[
            { value: 'opportunity', label: 'Opportunity' },
            { value: 'proposal-sent', label: 'Proposal Sent' },
            { value: 'won', label: 'Won' },
            { value: 'lost', label: 'Lost' },
        ]}
        noteStatuses={[
            { value: 'cold', label: 'Cold', color: '#7dbde8' },
            { value: 'warm', label: 'Warm', color: '#e8cb7d' },
            { value: 'hot', label: 'Hot', color: '#e88b7d' },
        ]}
        taskTypes={['Call', 'Email', 'Meeting']}
    />
);

export default App;
```

`<CRM>` accepts the following props:

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

## Using Test Data

Developing features with an empty database can be challenging. To help with this, Atomic CRM includes a CSV file with test data that can be imported into the application.

To import the test data, follow these steps:

1. Go to the contacts page.
2. Click the "Import" button.
3. Select the file located at `test-data/contacts.csv`.

## Customizing The Theme

Atomic CRM uses the Material-UI library for theming. You can customize the light and dark themes by setting the `lightTheme` and `darkTheme` props on the `<CRM>` component.

Check out react-admin's [theming documentation](https://marmelab.com/react-admin/Theming.html) for more information on how to customize the themes.

## Customizing The Layout

The components that make up the layout of the application (menu, container, etc) are located in the `src/layout` directory. You can customize the layout by modifying these components.

## Customizing the Homepage

The home page of the application is rendered by the `Dashboard.tsx` component. Updating this file to customize the dashboard.

Here is a simple example of a customized dashboard:

```jsx
// ./src/dashboard/Dashboard.tsx
import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';

export const Dashboard = () => (
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
```

## Disabling Telemetry

In production, atomic-crm applications send an anonymous request on mount to a telemetry server operated by Marmelab. You can see this request by looking at the Network tab of your browser DevTools:

```
https://atomic-crm-telemetry.marmelab.com/atomic-crm-telemetry
```

The only data sent to the telemetry server is the admin domain (e.g. “example.com”) - no personal data is ever sent, and no cookie is included in the response. The atomic-crm team uses these domains to track the usage of the framework.

You can opt out of telemetry by simply adding `disableTelemetry` to the `<CRM>` component:

```tsx
import { CRM } from './root/CRM';

const App = () => <CRM disableTelemetry />;

export default App;
```