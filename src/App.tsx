import { CRM } from "@/components/atomic-crm/root/CRM";
import { PublicApplicationApp } from "@/components/atomic-crm/public-application/PublicApplicationApp";
import { supabasePublicApplicationDataSource } from "@/components/atomic-crm/providers/supabase/publicApplicationDataSource";

/**
 * Application entry point
 *
 * Customize Atomic CRM by passing props to the CRM component:
 *  - companySectors
 *  - darkTheme
 *  - dealCategories
 *  - dealPipelineStatuses
 *  - dealStages
 *  - lightTheme
 *  - darkModeLogo / lightModeLogo
 *  - noteStatuses
 *  - taskTypes
 *  - title
 * ... as well as all the props accepted by shadcn-admin-kit's <Admin> component.
 *
 * Logos must be an imported asset, an absolute URL, or a data URI — never a
 * route-relative path like "./img/logo.png", which breaks on nested routes.
 *
 * @example
 * import logoDark from "./logo-dark.svg";
 * import logoLight from "./logo-light.svg";
 *
 * const App = () => (
 *    <CRM
 *       darkModeLogo={logoDark}
 *       lightModeLogo={logoLight}
 *       title="Acme CRM"
 *    />
 * );
 */
// Native Application Intake slice (§2/§15): /apply/* is a genuinely public,
// unauthenticated surface, rendered instead of <CRM/> (never alongside —
// see PublicApplicationApp.tsx's own header for why this keeps <CRM/>'s
// existing HashRouter behavior completely untouched). A plain pathname
// check, not a shared top-level Router: this decision has to happen
// before either tree mounts.
const App = () =>
  window.location.pathname.startsWith("/apply") ? (
    <PublicApplicationApp dataSource={supabasePublicApplicationDataSource} />
  ) : (
    <CRM />
  );

export default App;
