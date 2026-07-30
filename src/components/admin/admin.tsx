import {
  CoreAdminUI,
  type CoreAdminUIProps,
  CoreAdminContext,
  type CoreAdminContextProps,
  type CoreAdminProps,
  localStorageStore,
} from "ra-core";
import { i18nProvider as defaultI18nProvider } from "@/lib/i18nProvider";
import { Layout } from "@/components/admin/layout";
import { LoginPage } from "@/components/admin/login-page";
import { NotFound } from "@/components/admin/not-found";
import { Ready } from "@/components/admin/ready";
import { ThemeProvider } from "@/components/admin/theme-provider";
import { AuthCallback } from "@/components/admin/authentication";
import { useEffect } from "react";

const defaultStore = localStorageStore();

/**
 * Context provider for the Admin component.
 *
 * Wraps CoreAdminContext to provide core admin functionality including data provider,
 * auth provider, i18n provider, and store access to child components.
 *
 * @internal
 */
const AdminContext = (props: CoreAdminContextProps) => (
  <CoreAdminContext {...props} />
);

/**
 * UI component for the Admin application.
 *
 * Wraps CoreAdminUI with theme provider and handles telemetry reporting.
 * Provides the main layout, login page, ready page, and authentication callback.
 *
 * @internal
 */
const AdminUI = (props: CoreAdminUIProps) => {
  const { disableTelemetry = false, ...rest } = props;

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
    img.src = `https://shadcn-admin-kit-telemetry.marmelab.com/shadcn-admin-kit-telemetry?domain=${window.location.hostname}`;
  }, [disableTelemetry]);

  return (
    <ThemeProvider>
      <CoreAdminUI
        layout={Layout}
        loginPage={LoginPage}
        ready={Ready}
        authCallbackPage={AuthCallback}
        disableTelemetry // Disable telemetry in CoreAdminUI to avoid double logging
        {...rest}
      />
    </ThemeProvider>
  );
};

/**
 * Root component of a shadcn-admin-kit application.
 *
 * Creates context providers to allow its children to access the app configuration.
 * Renders the main routes and layout, and delegates content area rendering to Resource children.
 * Combines AdminContext and AdminUI to provide a complete admin interface.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/admin/ Admin documentation}
 *
 * @example
 * // Basic usage with dataProvider and Resources
 * import { Admin } from "@/components/admin";
 * import { Resource } from 'ra-core';
 * import simpleRestProvider from 'ra-data-simple-rest';
 *
 * const App = () => (
 *   <Admin dataProvider={simpleRestProvider('http://path.to.my.api')}>
 *     <Resource name="posts" list={PostList} />
 *   </Admin>
 * );
 *
 * @example
 * // With authentication and i18n
 * <Admin
 *   dataProvider={dataProvider}
 *   authProvider={authProvider}
 *   i18nProvider={i18nProvider}
 * >
 *   <Resource name="posts" list={PostList} edit={PostEdit} />
 * </Admin>
 */
export const Admin = (props: CoreAdminProps) => {
  const {
    accessDenied,
    authCallbackPage = AuthCallback,
    authenticationError,
    authProvider,
    basename,
    catchAll = NotFound,
    children,
    dashboard,
    dataProvider,
    disableTelemetry,
    error,
    i18nProvider = defaultI18nProvider,
    layout = Layout,
    loading,
    loginPage = LoginPage,
    queryClient,
    ready = Ready,
    requireAuth,
    store = defaultStore,
    title = "Shadcn Admin",
  } = props;
  return (
    <AdminContext
      authProvider={authProvider}
      basename={basename}
      dataProvider={dataProvider}
      i18nProvider={i18nProvider}
      queryClient={queryClient}
      store={store}
    >
      <AdminUI
        accessDenied={accessDenied}
        authCallbackPage={authCallbackPage}
        authenticationError={authenticationError}
        catchAll={catchAll}
        dashboard={dashboard}
        disableTelemetry={disableTelemetry}
        error={error}
        layout={layout}
        loading={loading}
        loginPage={loginPage}
        ready={ready}
        requireAuth={requireAuth}
        title={title}
      >
        {children}
      </AdminUI>
    </AdminContext>
  );
};
