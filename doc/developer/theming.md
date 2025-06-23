# Theming Atomic CRM

You can update the look and feel of Atomic CRM by customizing the themes, layout, and components.

## Changing the Title and Logo

Set the title and logo of the CRM application by passing the `title` and `logo` props to the `<CRM>` component in the `src/App.tsx` file. The logo path should be relative to the public directory.

```tsx
import { CRM } from './root/CRM';

const App = () => (
    <CRM
        title="ACME CRM"
        logo="./img/logo.png" // The logo path is relative to the public directory
    />
);
```

## Customizing The Theme

Atomic CRM accepts a custom theme to override the style of all components (fonts, colors, borders, etc). Use the `lightTheme` and `darkTheme` props on the `<CRM>` component to override the theme.

For example, you can use the `radiant` theme as follows:

```tsx
import { CRM } from './root/CRM';
import { radiantLightTheme, radiantDarkTheme } from 'react-admin';

const App = () => (
    <CRM
        lightTheme={radiantLightTheme}
        darkTheme={radiantDarkTheme}
    />
);
```

Atomic CRM comes with 5 built-in themes:

| | |
| - | - |
| &nbsp;&nbsp; [Default](https://marmelab.com/react-admin/AppTheme.html#default) [![Default light theme](https://marmelab.com/react-admin/img/defaultLightTheme1.jpg)]((AppTheme.html#default)) | &nbsp;&nbsp; [B&W](https://marmelab.com/react-admin/AppTheme.html#bw) [![B&W light theme](https://marmelab.com/react-admin/img/bwLightTheme1.jpg)](https://marmelab.com/react-admin/AppTheme.htmlml#bw) |
| &nbsp;&nbsp; [Nano](https://marmelab.com/react-admin/AppTheme.html#nano) [![Nano light theme](https://marmelab.com/react-admin/img/nanoLightTheme1.jpg)](https://marmelab.com/react-admin/AppTheme.htmlml#nano) | &nbsp;&nbsp; [Radiant](https://marmelab.com/react-admin/AppTheme.html#radiant) [![Radiant light theme](https://marmelab.com/react-admin/img/radiantLightTheme1.jpg)](https://marmelab.com/react-admin/AppTheme.htmlml#radiant) |
| &nbsp;&nbsp; [House](https://marmelab.com/react-admin/AppTheme.html#house) [![House light theme](https://marmelab.com/react-admin/img/houseLightTheme1.jpg)](https://marmelab.com/react-admin/AppTheme.htmlml#house) | |

You can also create your own theme from scratch to match your brand's identity.

Check out react-admin's [theming documentation](https://marmelab.com/react-admin/Theming.html) for more information on how to customize the theme.

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
