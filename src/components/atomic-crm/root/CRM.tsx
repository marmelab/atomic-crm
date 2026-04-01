import {
  type AuthProvider,
  type CoreAdminProps,
  CustomRoutes,
  localStorageStore,
  Resource,
} from "ra-core";
import { useEffect, useMemo } from "react";
import { Route } from "react-router";
import { QueryClient } from "@tanstack/react-query";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import { Admin } from "@/components/admin/admin";
import { useIsMobile } from "@/hooks/use-mobile";
import { ForgotPasswordPage } from "@/components/supabase/forgot-password-page";
import { OAuthConsentPage } from "@/components/supabase/oauth-consent-page";
import { SetPasswordPage } from "@/components/supabase/set-password-page";

import { Dashboard } from "../dashboard/Dashboard";
import { MobileDashboard } from "../dashboard/MobileDashboard";
import { MobileLayout } from "../layout/MobileLayout";
import { Layout } from "../layout/Layout";
import { ConfirmationRequired } from "../login/ConfirmationRequired";
import { SignupPage } from "../login/SignupPage";
import { StartPage } from "../login/StartPage";
import {
  authProvider as defaultAuthProvider,
  dataProvider as defaultDataProvider,
} from "../providers/supabase";
import type { CrmDataProvider } from "../providers/types";
import { ProfilePage } from "../settings/ProfilePage";
import { SettingsPage } from "../settings/SettingsPage";
import {
  type ConfigurationContextValue,
  CONFIGURATION_STORE_KEY,
} from "./ConfigurationContext";
import {
  defaultDarkModeLogo,
  defaultLightModeLogo,
  defaultNoteStatuses,
  defaultTaskTypes,
  defaultTitle,
} from "./defaultConfiguration";
import { i18nProvider } from "./i18nProvider";
import { getEnabledModules } from "./moduleRegistry";

const defaultStore = localStorageStore(undefined, "CRM");

export type CRMProps = {
  dataProvider?: CrmDataProvider;
  authProvider?: AuthProvider;
  disableTelemetry?: boolean;
  store?: CoreAdminProps["store"];
} & Partial<ConfigurationContextValue>;

export const CRM = ({
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

  if (!store.getItem(CONFIGURATION_STORE_KEY)) {
    store.setItem(CONFIGURATION_STORE_KEY, {
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

  const wrappedAuthProvider = useMemo<AuthProvider>(
    () => ({
      ...authProvider,
      login: async (params: unknown) => {
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
      handleCallback: async (params: unknown) => {
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
      logout: async (params: unknown) => {
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
      disableTelemetry={disableTelemetry}
      {...rest}
    />
  );
};

const renderCrmResources = (isMobile: boolean) =>
  getEnabledModules().map((module) => {
    const list = isMobile
      ? (module.components.mobileList ?? module.components.list)
      : module.components.list;

    return (
      <Resource
        key={module.resource}
        name={module.resource}
        list={list}
        show={module.components.show}
        edit={module.components.edit}
        create={module.components.create}
        recordRepresentation={
          module.components.recordRepresentation as
            | string
            | ((record: unknown) => string)
            | undefined
        }
      />
    );
  });

const DesktopAdmin = (props: CoreAdminProps) => (
  <Admin layout={Layout} dashboard={Dashboard} {...props}>
    <CustomRoutes noLayout>
      <Route path={SignupPage.path} element={<SignupPage />} />
      <Route
        path={ConfirmationRequired.path}
        element={<ConfirmationRequired />}
      />
      <Route path={SetPasswordPage.path} element={<SetPasswordPage />} />
      <Route path={ForgotPasswordPage.path} element={<ForgotPasswordPage />} />
      <Route path={OAuthConsentPage.path} element={<OAuthConsentPage />} />
    </CustomRoutes>

    <CustomRoutes>
      <Route path={ProfilePage.path} element={<ProfilePage />} />
      <Route path={SettingsPage.path} element={<SettingsPage />} />
    </CustomRoutes>

    {renderCrmResources(false)}
  </Admin>
);

const MobileAdmin = (props: CoreAdminProps) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 60 * 24,
        staleTime: 1000 * 60 * 2,
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
          <Route path={ProfilePage.path} element={<ProfilePage />} />
          <Route path={SettingsPage.path} element={<SettingsPage />} />
        </CustomRoutes>

        {renderCrmResources(true)}
      </Admin>
    </PersistQueryClientProvider>
  );
};
