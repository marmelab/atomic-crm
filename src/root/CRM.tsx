import { useEffect } from 'react';
import {
    Admin,
    CustomRoutes,
    ListGuesser,
    RaThemeOptions,
    Resource,
    defaultTheme,
    localStorageStore,
} from 'react-admin';
import type { AdminProps, AuthProvider, DataProvider } from 'react-admin';
import { deepmerge } from '@mui/utils';
import { Route } from 'react-router';
import { ForgotPasswordPage, SetPasswordPage } from 'ra-supabase';

import { Layout } from '../layout/Layout';
import { i18nProvider } from './i18nProvider';
import companies from '../companies';
import contacts from '../contacts';
import { Dashboard } from '../dashboard/Dashboard';
import engagements from '../engagements';
import { LoginPage } from '../login/LoginPage';
import { SignupPage } from '../login/SignupPage';
import {
    authProvider as defaultAuthProvider,
    dataProvider as defaultDataProvider,
} from '../providers/supabase';
import sales from '../sales';
import { SettingsPage } from '../settings/SettingsPage';
import {
    ConfigurationContextValue,
    ConfigurationProvider,
} from './ConfigurationContext';
import {
    defaultCompanySectors,
    defaultContactGender,
    defaultEngagementCategories,
    defaultEngagementPipelineStatuses,
    defaultEngagementStages,
    defaultLogo,
    defaultNoteStatuses,
    defaultTaskTypes,
    defaultTitle,
} from './defaultConfiguration';

// Define the interface for the CRM component props
export type CRMProps = {
    dataProvider?: DataProvider;
    authProvider?: AuthProvider;
    lightTheme?: RaThemeOptions;
    darkTheme?: RaThemeOptions;
} & Partial<ConfigurationContextValue> &
    Partial<AdminProps>;

const defaultLightTheme = deepmerge(defaultTheme, {
    palette: {
        background: {
            default: '#fafafb',
        },
        primary: {
            main: '#2F68AC',
        },
    },
    components: {
        RaFileInput: {
            styleOverrides: {
                root: {
                    '& .RaFileInput-dropZone': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    },
                },
            },
        },
    },
});

/**
 * CRM Component
 *
 * This component sets up and renders the main CRM application using `react-admin`. It provides
 * default configurations and themes but allows for customization through props. The component
 * wraps the application with a `ConfigurationProvider` to provide configuration values via context.
 *
 * @param {Array<ContactGender>} contactGender - The gender options for contacts used in the application.
 * @param {string[]} companySectors - The list of company sectors used in the application.
 * @param {RaThemeOptions} darkTheme - The theme to use when the application is in dark mode.
 * @param {string[]} dealCategories - The categories of deals used in the application.
 * @param {string[]} dealPipelineStatuses - The statuses of deals in the pipeline used in the application.
 * @param {DealStage[]} dealStages - The stages of deals used in the application.
 * @param {RaThemeOptions} lightTheme - The theme to use when the application is in light mode.
 * @param {string} logo - The logo used in the CRM application.
 * @param {NoteStatus[]} noteStatuses - The statuses of notes used in the application.
 * @param {string[]} taskTypes - The types of tasks used in the application.
 * @param {string} title - The title of the CRM application.
 *
 * @returns {JSX.Element} The rendered CRM application.
 *
 * @example
 * // Basic usage of the CRM component
 * import { CRM } from './CRM';
 *
 * const App = () => (
 *     <CRM
 *         logo="/path/to/logo.png"
 *         title="My Custom CRM"
 *         lightTheme={{
 *             ...defaultTheme,
 *             palette: {
 *                 primary: { main: '#0000ff' },
 *             },
 *         }}
 *     />
 * );
 *
 * export default App;
 */
export const CRM = ({
    contactGender = defaultContactGender,
    companySectors = defaultCompanySectors,
    darkTheme,
    engagementCategories = defaultEngagementCategories,
    engagementPipelineStatuses = defaultEngagementPipelineStatuses,
    engagementStages = defaultEngagementStages,
    lightTheme = defaultLightTheme,
    logo = defaultLogo,
    noteStatuses = defaultNoteStatuses,
    taskTypes = defaultTaskTypes,
    title = defaultTitle,
    dataProvider = defaultDataProvider,
    authProvider = defaultAuthProvider,
    disableTelemetry,
    ...rest
}: CRMProps) => {
    useEffect(() => {
        if (
            disableTelemetry ||
            process.env.NODE_ENV !== 'production' ||
            typeof window === 'undefined' ||
            typeof window.location === 'undefined' ||
            typeof Image === 'undefined'
        ) {
            return;
        }
        const img = new Image();
        img.src = `https://atomic-crm-telemetry.marmelab.com/atomic-crm-telemetry?domain=${window.location.hostname}`;
    }, [disableTelemetry]);

    return (
        <ConfigurationProvider
            contactGender={contactGender}
            companySectors={companySectors}
            engagementCategories={engagementCategories}
            engagementPipelineStatuses={engagementPipelineStatuses}
            engagementStages={engagementStages}
            logo={logo}
            noteStatuses={noteStatuses}
            taskTypes={taskTypes}
            title={title}
        >
            <Admin
                dataProvider={dataProvider}
                authProvider={authProvider}
                store={localStorageStore(undefined, 'CRM')}
                layout={Layout}
                loginPage={LoginPage}
                dashboard={Dashboard}
                theme={lightTheme}
                darkTheme={darkTheme || null}
                i18nProvider={i18nProvider}
                requireAuth
                disableTelemetry
                {...rest}
            >
                <CustomRoutes noLayout>
                    <Route path={SignupPage.path} element={<SignupPage />} />
                    <Route
                        path={SetPasswordPage.path}
                        element={<SetPasswordPage />}
                    />
                    <Route
                        path={ForgotPasswordPage.path}
                        element={<ForgotPasswordPage />}
                    />
                </CustomRoutes>

                <CustomRoutes>
                    <Route
                        path={SettingsPage.path}
                        element={<SettingsPage />}
                    />
                </CustomRoutes>
                <Resource name="engagements" {...engagements} />
                <Resource name="contacts" {...contacts} />
                <Resource name="companies" {...companies} />
                <Resource name="contactNotes" />
                <Resource name="engagementNotes" />
                <Resource name="tasks" list={ListGuesser} />
                <Resource name="sales" {...sales} />
                <Resource name="tags" list={ListGuesser} />
            </Admin>
        </ConfigurationProvider>
    );
};
