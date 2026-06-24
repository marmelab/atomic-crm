import {
  type CoreAdminProps,
  CustomRoutes,
  localStorageStore,
  Resource,
  type AuthProvider,
} from "ra-core";
import { useEffect, useMemo } from "react";
import { Route } from "react-router";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { Admin } from "@/components/admin/admin";
import { ForgotPasswordPage } from "@/components/supabase/forgot-password-page";
import { SetPasswordPage } from "@/components/supabase/set-password-page";
import { OAuthConsentPage } from "@/components/supabase/oauth-consent-page";

import companies from "../companies";
import contacts from "../contacts";
import calendarEvents from "../calendar";
import { Dashboard } from "../dashboard/Dashboard";
import { MobileDashboard } from "../dashboard/MobileDashboard";
import deals from "../deals";
import quotes from "../quotes";
import emailTemplates from "../templates";
import sequences from "../sequences";
import { leadImportRuns, leadImportSources } from "../lead-imports";
import { Layout } from "../layout/Layout";
import { MobileLayout } from "../layout/MobileLayout";
import { SignupPage } from "../login/SignupPage";
import { ConfirmationRequired } from "../login/ConfirmationRequired";
import { ImportPage } from "../misc/ImportPage";
import {
  authProvider as defaultAuthProvider,
  dataProvider as defaultDataProvider,
} from "../providers/supabase";
import sales from "../sales";
import { SettingsPageMobile } from "../settings/SettingsPageMobile";
import { MobileCrmConfigPage } from "../settings/MobileCrmConfigPage";
import { ProfilePage } from "../settings/ProfilePage";
import { SettingsPage } from "../settings/SettingsPage";
import {
  CONFIGURATION_STORE_KEY,
  type ConfigurationContextValue,
} from "./ConfigurationContext";
import type { CrmDataProvider } from "../providers/types";
import {
  defaultCompanySectors,
  defaultCurrency,
  defaultDarkModeLogo,
  defaultDealCategories,
  defaultDealPipelineStatuses,
  defaultDealStages,
  defaultLightModeLogo,
  defaultNoteStatuses,
  defaultTaskTypes,
  defaultTitle,
} from "./defaultConfiguration";
import { i18nProvider } from "../providers/commons/i18nProvider";
import { StartPage } from "../login/StartPage.tsx";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { MobileTasksList } from "../tasks/MobileTasksList.tsx";
import { ContactListMobile } from "../contacts/ContactList.tsx";
import { ContactShow } from "../contacts/ContactShow.tsx";
import { CompanyShow } from "../companies/CompanyShow.tsx";
import { NoteShowPage } from "../notes/NoteShowPage.tsx";
import { CallQueue, MobileCallQueue } from "../call-queue";
import { CalendarPage } from "../calendar";
import { CompanyListMobile } from "../companies/CompanyListMobile";
import { MobileDealsList } from "../deals/MobileDealsList";
import { DealShow } from "../deals/DealShow";
import { MobileQuotesList } from "../quotes/MobileQuotesList";
import { QuoteShow } from "../quotes/QuoteShow";
import { MobileSalesList } from "../sales/MobileSalesList";
import { MobileSequencesList } from "../sequences/MobileSequencesList";
import { MobileEmailTemplatesList } from "../templates/MobileEmailTemplatesList";
import { CustomerVisibilityPage } from "../customer-visibility/CustomerVisibilityPage";

const defaultStore = localStorageStore(undefined, "CRM");

export type CRMProps = {
  dataProvider?: CrmDataProvider;
  authProvider?: AuthProvider;
  disableTelemetry?: boolean;
  store?: CoreAdminProps["store"];
} & Partial<ConfigurationContextValue>;

/**
 * CRM Component
 *
 * This component sets up and renders the main CRM application using `ra-core`. It provides
 * default configurations and themes but allows for customization through props. The component
 * seeds the store with any custom prop values for backwards compatibility.
 *
 * @param {LabeledValue[]} companySectors - The list of company sectors used in the application.
 * @param {string} currency - The ISO 4217 currency code used to format monetary values (e.g. "USD", "EUR", "GBP").
 * @param {RaThemeOptions} darkTheme - The theme to use when the application is in dark mode.
 * @param {LabeledValue[]} dealCategories - The categories of deals used in the application.
 * @param {string[]} dealPipelineStatuses - The statuses of deals in the pipeline used in the application.
 * @param {DealStage[]} dealStages - The stages of deals used in the application.
 * @param {RaThemeOptions} lightTheme - The theme to use when the application is in light mode.
 * @param {string} logo - The logo used in the CRM application.
 * @param {NoteStatus[]} noteStatuses - The statuses of notes used in the application.
 * @param {LabeledValue[]} taskTypes - The types of tasks used in the application.
 * @param {string} title - The title of the CRM application.
 *
 * @returns {JSX.Element} The rendered CRM application.
 *
 * @example
 * // Basic usage of the CRM component
 * import { CRM } from '@/components/atomic-crm/dashboard/CRM';
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
  companySectors = defaultCompanySectors,
  currency = defaultCurrency,
  dealCategories = defaultDealCategories,
  dealPipelineStatuses = defaultDealPipelineStatuses,
  dealStages = defaultDealStages,
  darkModeLogo = defaultDarkModeLogo,
  lightModeLogo = defaultLightModeLogo,
  noteStatuses = defaultNoteStatuses,
  taskTypes = defaultTaskTypes,
  title = defaultTitle,
  dataProvider = defaultDataProvider,
  authProvider = defaultAuthProvider,
  store = defaultStore,
  googleWorkplaceDomain = import.meta.env.VITE_GOOGLE_WORKPLACE_DOMAIN,
  disableEmailPasswordAuthentication = import.meta.env
    .VITE_DISABLE_EMAIL_PASSWORD_AUTHENTICATION === "true",
  disableTelemetry,
  ...rest
}: CRMProps) => {
  useEffect(() => {
    if (
      disableTelemetry ||
      process.env.NODE_ENV !== "production" ||
      typeof window === "undefined" ||
      typeof window.location === "undefined" ||
      typeof Image === "undefined"
    ) {
      return;
    }
    const img = new Image();
    img.src = `https://atomic-crm-telemetry.marmelab.com/atomic-crm-telemetry?domain=${window.location.hostname}`;
  }, [disableTelemetry]);

  // Seed the store with CRM prop values if not already stored
  // (backwards compatibility for prop-based config)
  if (!store.getItem(CONFIGURATION_STORE_KEY)) {
    store.setItem(CONFIGURATION_STORE_KEY, {
      companySectors,
      currency,
      dealCategories,
      dealPipelineStatuses,
      dealStages,
      noteStatuses,
      taskTypes,
      title,
      darkModeLogo,
      lightModeLogo,
      googleWorkplaceDomain,
      disableEmailPasswordAuthentication,
    } satisfies ConfigurationContextValue);
  }

  const isMobile = useIsMobile();

  // on login, pre-fetch the configuration to avoid a flickering
  // when accessing the app for the first time
  const wrappedAuthProvider = useMemo<AuthProvider>(
    () => ({
      ...authProvider,
      login: async (params: any) => {
        const result = await authProvider.login(params);
        try {
          const config = await dataProvider.getConfiguration();
          if (Object.keys(config).length > 0) {
            store.setItem(CONFIGURATION_STORE_KEY, config);
          }
        } catch {
          // Non-critical: config will load via useConfigurationLoader
        }
        return result;
      },
      handleCallback: async (params: any) => {
        if (!authProvider.handleCallback) {
          throw new Error(
            "handleCallback is not implemented in the authProvider",
          );
        }
        const result = await authProvider.handleCallback(params);
        try {
          const config = await dataProvider.getConfiguration();
          if (Object.keys(config).length > 0) {
            store.setItem(CONFIGURATION_STORE_KEY, config);
          }
        } catch {
          // Non-critical: config will load via useConfigurationLoader
        }
        return result;
      },
      logout: async (params: any) => {
        try {
          store.removeItem(CONFIGURATION_STORE_KEY);
        } catch {
          // Ignore
        }
        return authProvider.logout(params);
      },
    }),
    [authProvider, dataProvider, store],
  );

  const ResponsiveAdmin = isMobile ? MobileAdmin : DesktopAdmin;

  return (
    <ResponsiveAdmin
      dataProvider={dataProvider}
      authProvider={wrappedAuthProvider}
      i18nProvider={i18nProvider}
      store={store}
      loginPage={StartPage}
      requireAuth
      disableTelemetry
      {...rest}
    />
  );
};

const DesktopAdmin = (props: CoreAdminProps) => {
  return (
    <Admin layout={Layout} dashboard={Dashboard} {...props}>
      <CustomRoutes noLayout>
        <Route path={SignupPage.path} element={<SignupPage />} />
        <Route
          path={ConfirmationRequired.path}
          element={<ConfirmationRequired />}
        />
        <Route path={SetPasswordPage.path} element={<SetPasswordPage />} />
        <Route
          path={ForgotPasswordPage.path}
          element={<ForgotPasswordPage />}
        />
        <Route path={OAuthConsentPage.path} element={<OAuthConsentPage />} />
      </CustomRoutes>

      <CustomRoutes>
        <Route path={ProfilePage.path} element={<ProfilePage />} />
        <Route path={SettingsPage.path} element={<SettingsPage />} />
        <Route path={ImportPage.path} element={<ImportPage />} />
        <Route path="/call-queue" element={<CallQueue />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/customer-radar" element={<CustomerVisibilityPage />} />
      </CustomRoutes>
      <Resource name="deals" {...deals} />
      <Resource name="quotes" {...quotes} />
      <Resource name="contacts" {...contacts} />
      <Resource name="companies" {...companies} />
      <Resource name="contact_notes" />
      <Resource name="deal_notes" />
      <Resource name="call_logs" />
      <Resource name="quote_line_items" />
      <Resource name="tasks" />
      <Resource name="calendar_events" {...calendarEvents} />
      <Resource name="sales" {...sales} />
      <Resource name="email_templates" {...emailTemplates} />
      <Resource name="email_sends" />
      <Resource name="sequences" {...sequences} />
      <Resource name="sequence_steps" />
      <Resource name="sequence_enrollments" />
      <Resource name="lead_import_sources" {...leadImportSources} />
      <Resource name="lead_import_runs" {...leadImportRuns} />
      <Resource name="meeting_transcriptions" />
      <Resource name="tags" />
      <Resource name="feedback_items" />
      <Resource name="customer_details" />
      <Resource name="website_snapshots" />
      <Resource name="monthly_reports" />
    </Admin>
  );
};

const MobileAdmin = (props: CoreAdminProps) => {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
            networkMode: "offlineFirst",
          },
          mutations: {
            networkMode: "offlineFirst",
          },
        },
      }),
    [],
  );
  const asyncStoragePersister = useMemo(
    () => createAsyncStoragePersister({ storage: localStorage }),
    [],
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <Admin
        queryClient={queryClient}
        layout={MobileLayout}
        dashboard={MobileDashboard}
        {...props}
      >
        <CustomRoutes noLayout>
          <Route path={SignupPage.path} element={<SignupPage />} />
          <Route
            path={ConfirmationRequired.path}
            element={<ConfirmationRequired />}
          />
          <Route path={SetPasswordPage.path} element={<SetPasswordPage />} />
          <Route
            path={ForgotPasswordPage.path}
            element={<ForgotPasswordPage />}
          />
          <Route path={OAuthConsentPage.path} element={<OAuthConsentPage />} />
        </CustomRoutes>
        <CustomRoutes>
          <Route
            path={SettingsPageMobile.path}
            element={<SettingsPageMobile />}
          />
          <Route
            path={MobileCrmConfigPage.path}
            element={<MobileCrmConfigPage />}
          />
          <Route path={ImportPage.path} element={<ImportPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/call-queue" element={<MobileCallQueue />} />
          <Route path="/customer-radar" element={<CustomerVisibilityPage />} />
        </CustomRoutes>
        <Resource
          name="contacts"
          list={ContactListMobile}
          show={ContactShow}
          recordRepresentation={contacts.recordRepresentation}
        >
          <Route path=":id/notes/:noteId" element={<NoteShowPage />} />
        </Resource>
        <Resource
          name="companies"
          list={CompanyListMobile}
          show={CompanyShow}
        />
        <Resource name="deals" list={MobileDealsList} show={DealShow} />
        <Resource name="quotes" list={MobileQuotesList} show={QuoteShow} />
        <Resource name="deal_notes" />
        <Resource name="call_logs" />
        <Resource name="quote_line_items" />
        <Resource name="tasks" list={MobileTasksList} />
        <Resource name="sales" list={MobileSalesList} />
        <Resource name="email_templates" list={MobileEmailTemplatesList} />
        <Resource name="email_sends" />
        <Resource name="sequences" list={MobileSequencesList} />
        <Resource name="sequence_steps" />
        <Resource name="sequence_enrollments" />
        <Resource name="lead_import_sources" {...leadImportSources} />
        <Resource name="lead_import_runs" {...leadImportRuns} />
        <Resource name="meeting_transcriptions" />
        <Resource name="tags" />
        <Resource name="feedback_items" />
        <Resource name="customer_details" />
        <Resource name="website_snapshots" />
        <Resource name="monthly_reports" />
        <Resource name="calendar_events" {...calendarEvents} />
      </Admin>
    </PersistQueryClientProvider>
  );
};
