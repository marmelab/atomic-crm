import { CRM } from './root/CRM';
import { radiantLightTheme, radiantDarkTheme } from 'react-admin';

/**
 * Application entry point
 *
 * Customize Atomic CRM by passing props to the CRM component:
 *  - contactGender
 *  - companySectors
 *  - darkTheme
 *  - dealCategories
 *  - dealPipelineStatuses
 *  - dealStages
 *  - lightTheme
 *  - logo
 *  - noteStatuses
 *  - taskTypes
 *  - title
 * ... as well as all the props accepted by react-admin's <Admin> component.
 *
 * @example
 * const App = () => (
 *    <CRM
 *       logo="./img/logo.png"
 *       title="Acme CRM"
 *    />
 * );
 */
const App = () => (
    <CRM
        title="GDev"
        logo="./img/gdev_logo.png" // The logo path is relative to the public directory
        lightTheme={radiantLightTheme}
        darkTheme={radiantDarkTheme}
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
