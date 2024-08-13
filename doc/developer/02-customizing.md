# Customizing Atomic CRM

## CRM component

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