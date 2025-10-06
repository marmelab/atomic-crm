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

For instance, the following code snippet shows how to customize the CRM application domain-specific data.

```tsx
import { CRM } from './root/CRM';

const App = () => (
    <CRM
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

| Props                   | Description                                                           | Type            |
|-------------------------|-----------------------------------------------------------------------|-----------------|
| `contactGender`         | The gender options for contacts used in the application.              | ContactGender[] |
| `companySectors`        | The list of company sectors used in the application.                  | string[]       |
| `darkTheme`             | The theme to use when the application is in dark mode.                | RaThemeOptions  |
| `dealCategories`        | The categories of deals used in the application.                      | string[]        |
| `dealPipelineStatuses`  | The statuses of deals in the pipeline used in the application         | string[]        |
| `dealStages`            | The stages of deals used in the application.                          | DealStage[]     |
| `lightTheme`            | The theme to use when the application is in light mode.               | RaThemeOptions  |
| `logo`                  | The logo used in the CRM application.                                 | string          |
| `noteStatuses`          | The statuses of notes used in the application.                        | NoteStatus[]    |
| `taskTypes`             | The types of tasks used in the application.                           | string[]        |
| `title`                 | The title of the CRM application.                                     | string          |

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
