import type {
  CoreAdminProps,
  AuthProvider,
  DashboardComponent,
  LayoutComponent,
} from "ra-core";
import { CustomRoutes, localStorageStore, Resource } from "ra-core";
import { useEffect, useMemo } from "react";
import { Route } from "react-router";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { Admin } from "@/components/admin/admin";
import { ForgotPasswordPage } from "@/components/supabase/forgot-password-page";
import { SetPasswordPage } from "@/components/supabase/set-password-page";
import { OAuthConsentPage } from "@/components/supabase/oauth-consent-page";

import applications from "../applications";
import cohorts from "../cohorts";
import companies from "../companies";
import contacts from "../contacts";
import { Dashboard } from "../dashboard/Dashboard";
import { MobileDashboard } from "../dashboard/MobileDashboard";
import deals from "../deals";
import enrollments from "../enrollments";
import offers from "../offers";
import { Layout } from "../layout/Layout";
import { MobileLayout } from "../layout/MobileLayout";
import { SignupPage } from "../login/SignupPage";
import { ConfirmationRequired } from "../login/ConfirmationRequired";
import { ImportPage } from "../misc/ImportPage";
import { ChangelogPage } from "../misc/ChangelogPage";
import { GroupProgramPage } from "../programs/GroupProgramPage";
import { IndividualProgramPage } from "../programs/IndividualProgramPage";
import { ProgramsPage } from "../programs/ProgramsPage";
import { ResolveSalesCallPage } from "../sales-calls/ResolveSalesCallPage";
import { ResolveCadenceIssuePage } from "../sessions/ResolveCadenceIssuePage";
import { LivingExampleApplicationPage } from "../public-application/LivingExampleApplicationPage";
import { GrowingYourselfUpApplicationPage } from "../public-application/GrowingYourselfUpApplicationPage";
import { createDataProviderPublicApplicationDataSource } from "../public-application/publicApplicationDataSource";
import type { PublicApplicationDataSource } from "../public-application/publicApplicationDataSource";
import { OfferPage } from "../deals/OfferPage";
import { createDataProviderPublicOfferPageDataSource } from "../deals/publicOfferPageDataSource";
import type { PublicOfferPageDataSource } from "../deals/publicOfferPageDataSource";
import { ScholarshipCheckoutInvalidatorProvider } from "../deals/ScholarshipCheckoutInvalidatorContext";
import { noopScholarshipCheckoutInvalidator } from "../deals/scholarshipCheckoutInvalidator";
import type { ScholarshipCheckoutInvalidator } from "../deals/scholarshipCheckoutInvalidator";
import {
  getAuthProvider as defaultAuthProviderBuilder,
  getDataProvider as defaultDataProviderBuilder,
} from "../providers/supabase";
import sales from "../sales";
import { SettingsPageMobile } from "../settings/SettingsPageMobile";
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
import { i18nProvider as defaulti18nProvider } from "../providers/commons/i18nProvider";
import { StartPage } from "../login/StartPage.tsx";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { MobileTasksList } from "../tasks/MobileTasksList.tsx";
import { ContactListMobile } from "../contacts/ContactList.tsx";
import { ContactShow } from "../contacts/ContactShow.tsx";
import { CompanyShow } from "../companies/CompanyShow.tsx";
import { NoteShowPage } from "../notes/NoteShowPage.tsx";

const defaultStore = localStorageStore(undefined, "CRM");

export type CRMProps = {
  dataProvider?: CrmDataProvider;
  authProvider?: AuthProvider;
  i18nProvider?: CoreAdminProps["i18nProvider"];
  disableTelemetry?: boolean;
  store?: CoreAdminProps["store"];
  dashboard?: DashboardComponent;
  layout?: LayoutComponent;
  // Native Application Intake acceptance-repair pass: the public /apply
  // routes' read+write boundary (§15 — RLS blocks an anon client from
  // reading Offers/Cohorts or writing Contacts/Deals/Applications/Tasks
  // directly, so production must go through the public_application Edge
  // Function while FakeRest dev/demo can call the dataProvider directly).
  // Each entry (src/App.tsx, demo/App.tsx) passes the implementation that
  // matches its own dataProvider; defaults to a dataProvider-backed one
  // built from CRM's own `dataProvider` prop so <CRM/> never crashes if
  // an integration forgets to pass one (fails loud — RLS rejects the
  // call — rather than silently misbehaving).
  publicApplicationDataSource?: PublicApplicationDataSource;
  // Payment domain foundation slice: same dual-implementation boundary as
  // publicApplicationDataSource above, for the public personalized Offer
  // Page (/offer/:token) — see deals/publicOfferPageDataSource.ts.
  publicOfferPageDataSource?: PublicOfferPageDataSource;
  // Scholarship Pricing + Capacity slice: best-effort Stripe stale-
  // Checkout-Session invalidation, called after a Deal's pricing_mode
  // changes. Real implementation only exists for the Supabase-backed
  // production app (needs a server-side Stripe call) — defaults to a
  // no-op (FakeRest/demo has no real Stripe integration to invalidate
  // anything against). See deals/scholarshipCheckoutInvalidator.ts.
  scholarshipCheckoutInvalidator?: ScholarshipCheckoutInvalidator;
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
 * @param {string} darkModeLogo - Logo shown in dark mode and on the auth pages. Must be an imported asset, an absolute URL, or a data URI — never a route-relative path like "./logos/x.svg", which breaks on nested routes such as /oauth/consent (issue #291).
 * @param {string} lightModeLogo - Logo shown in light mode. Same rule as darkModeLogo: imported asset, absolute URL, or data URI only.
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
 *         darkModeLogo="https://example.com/logo-dark.svg"
 *         lightModeLogo="https://example.com/logo-light.svg"
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
  dataProvider = defaultDataProviderBuilder(),
  authProvider = defaultAuthProviderBuilder(),
  i18nProvider = defaulti18nProvider,
  store = defaultStore,
  disableTelemetry,
  publicApplicationDataSource,
  publicOfferPageDataSource,
  scholarshipCheckoutInvalidator = noopScholarshipCheckoutInvalidator,
  ...rest
}: CRMProps) => {
  const resolvedPublicApplicationDataSource = useMemo(
    () =>
      publicApplicationDataSource ??
      createDataProviderPublicApplicationDataSource(dataProvider),
    [publicApplicationDataSource, dataProvider],
  );
  const resolvedPublicOfferPageDataSource = useMemo(
    () =>
      publicOfferPageDataSource ??
      createDataProviderPublicOfferPageDataSource(dataProvider),
    [publicOfferPageDataSource, dataProvider],
  );

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
  useEffect(() => {
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
      } satisfies ConfigurationContextValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store]);

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
    <ScholarshipCheckoutInvalidatorProvider
      value={scholarshipCheckoutInvalidator}
    >
      <ResponsiveAdmin
        dataProvider={dataProvider}
        authProvider={wrappedAuthProvider}
        i18nProvider={i18nProvider}
        store={store}
        loginPage={StartPage}
        requireAuth
        disableTelemetry
        publicApplicationDataSource={resolvedPublicApplicationDataSource}
        publicOfferPageDataSource={resolvedPublicOfferPageDataSource}
        {...rest}
      />
    </ScholarshipCheckoutInvalidatorProvider>
  );
};

const DesktopAdmin = (
  props: CoreAdminProps & {
    dashboard?: DashboardComponent;
    layout?: LayoutComponent;
    publicApplicationDataSource: PublicApplicationDataSource;
    publicOfferPageDataSource: PublicOfferPageDataSource;
  },
) => {
  const {
    publicApplicationDataSource,
    publicOfferPageDataSource,
    ...adminProps
  } = props;
  return (
    <Admin
      layout={adminProps.layout ?? Layout}
      dashboard={adminProps.dashboard ?? Dashboard}
      {...adminProps}
    >
      {/* Native Application Intake acceptance-repair pass: /apply/* joins
          this SAME "custom routes with no layout are always rendered,
          regardless of the auth status" escape hatch Signup/ForgotPassword/
          etc. already use (ra-core's own CoreAdminRoutes.tsx comment) —
          the ONLY mechanism in this app that renders a route with no auth
          gate. Reusing it (rather than a second top-level Router branching
          on window.location.pathname, the original approach) is what makes
          a public submission and the CRM's own read of that data share the
          exact same live dataProvider/HashRouter instance: crossing between
          "/#/apply/..." and any other "/#/..." path is a same-document hash
          change, never a full page reload, so FakeRest's in-memory demo
          store (module-singleton, reseeded fresh on every real page load)
          survives the crossing. The previous PublicApplicationApp.tsx (its
          own standalone BrowserRouter, chosen via a pathname check in
          src/App.tsx / demo/App.tsx before either tree mounted) forced a
          hard navigation at exactly that crossing and is why a human
          tester's post-submission Contact/Application/Opportunity/Task
          never appeared — deleted, not superseded by a second mechanism. */}
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
        <Route
          path={LivingExampleApplicationPage.path}
          element={
            <LivingExampleApplicationPage
              dataSource={publicApplicationDataSource}
            />
          }
        />
        <Route
          path={GrowingYourselfUpApplicationPage.path}
          element={
            <GrowingYourselfUpApplicationPage
              dataSource={publicApplicationDataSource}
            />
          }
        />
        <Route
          path={OfferPage.path}
          element={<OfferPage dataSource={publicOfferPageDataSource} />}
        />
      </CustomRoutes>

      <CustomRoutes>
        <Route path={ProfilePage.path} element={<ProfilePage />} />
        <Route path={SettingsPage.path} element={<SettingsPage />} />
        <Route path={ImportPage.path} element={<ImportPage />} />
        <Route path={ChangelogPage.path} element={<ChangelogPage />} />
        <Route path={ProgramsPage.path} element={<ProgramsPage />} />
        <Route
          path={IndividualProgramPage.path}
          element={<IndividualProgramPage />}
        />
        <Route path={GroupProgramPage.path} element={<GroupProgramPage />} />
        <Route
          path={ResolveSalesCallPage.path}
          element={<ResolveSalesCallPage />}
        />
        <Route
          path={ResolveCadenceIssuePage.path}
          element={<ResolveCadenceIssuePage />}
        />
      </CustomRoutes>
      <Resource name="deals" {...deals} />
      <Resource name="applications" {...applications} />
      <Resource
        name="enrollments"
        {...enrollments}
        options={{ label: "Clients" }}
      />
      <Resource name="cohorts" {...cohorts} />
      <Resource name="contacts" {...contacts} />
      <Resource name="companies" {...companies} />
      <Resource name="offers" {...offers} />
      <Resource name="offer_payment_options" />
      <Resource name="waitlist_entries" />
      <Resource name="sales_calls" />
      <Resource name="contact_notes" />
      <Resource name="deal_notes" />
      <Resource name="tasks" />
      <Resource name="sales" {...sales} />
      <Resource name="tags" />
    </Admin>
  );
};

const MobileAdmin = (
  props: CoreAdminProps & {
    dashboard?: DashboardComponent;
    layout?: LayoutComponent;
    publicApplicationDataSource: PublicApplicationDataSource;
    publicOfferPageDataSource: PublicOfferPageDataSource;
  },
) => {
  const {
    publicApplicationDataSource,
    publicOfferPageDataSource,
    ...adminProps
  } = props;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 60 * 24, // 24 hours
        networkMode: "offlineFirst",
      },
      mutations: {
        networkMode: "offlineFirst",
      },
    },
  });
  const asyncStoragePersister = createAsyncStoragePersister({
    storage: localStorage,
  });

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <Admin
        queryClient={queryClient}
        layout={adminProps.layout ?? MobileLayout}
        dashboard={adminProps.dashboard ?? MobileDashboard}
        {...adminProps}
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
          <Route
            path={LivingExampleApplicationPage.path}
            element={
              <LivingExampleApplicationPage
                dataSource={publicApplicationDataSource}
              />
            }
          />
          <Route
            path={GrowingYourselfUpApplicationPage.path}
            element={
              <GrowingYourselfUpApplicationPage
                dataSource={publicApplicationDataSource}
              />
            }
          />
          <Route
            path={OfferPage.path}
            element={<OfferPage dataSource={publicOfferPageDataSource} />}
          />
        </CustomRoutes>
        <CustomRoutes>
          <Route
            path={SettingsPageMobile.path}
            element={<SettingsPageMobile />}
          />
          <Route path={ChangelogPage.path} element={<ChangelogPage />} />
          <Route path={ProgramsPage.path} element={<ProgramsPage />} />
          <Route
            path={IndividualProgramPage.path}
            element={<IndividualProgramPage />}
          />
          <Route path={GroupProgramPage.path} element={<GroupProgramPage />} />
          <Route
            path={ResolveSalesCallPage.path}
            element={<ResolveSalesCallPage />}
          />
          <Route
            path={ResolveCadenceIssuePage.path}
            element={<ResolveCadenceIssuePage />}
          />
        </CustomRoutes>
        {/* Opportunities/Programs/Clients are primary mobile nav destinations
            (see layout/MobileNavigation.tsx); Applications joins Contacts/
            Tasks/Settings under "More". Cohorts gets only a `show` route —
            reachable from a Programs hub card, never a mobile nav item or a
            list route of its own (routing/shell regression fix). */}
        <Resource name="deals" {...deals} />
        <Resource
          name="enrollments"
          {...enrollments}
          options={{ label: "Clients" }}
        />
        <Resource name="applications" {...applications} />
        <Resource name="waitlist_entries" />
        <Resource name="sales_calls" />
        <Resource name="cohorts" show={cohorts.show} edit={cohorts.edit} />
        <Resource
          name="contacts"
          list={ContactListMobile}
          show={ContactShow}
          recordRepresentation={contacts.recordRepresentation}
        >
          <Route path=":id/notes/:noteId" element={<NoteShowPage />} />
        </Resource>
        <Resource name="companies" show={CompanyShow} />
        <Resource name="tasks" list={MobileTasksList} />
      </Admin>
    </PersistQueryClientProvider>
  );
};
