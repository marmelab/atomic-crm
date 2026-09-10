import { CRM } from "@/components/atomic-crm/root/CRM";
import { supabasePublicApplicationDataSource } from "@/components/atomic-crm/providers/supabase/publicApplicationDataSource";
import { supabasePublicOfferPageDataSource } from "@/components/atomic-crm/providers/supabase/publicOfferPageDataSource";
import { supabaseScholarshipCheckoutInvalidator } from "@/components/atomic-crm/providers/supabase/scholarshipCheckoutInvalidator";

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
// Native Application Intake (§2/§15), acceptance-repair pass: /apply/* is
// registered as an unauthenticated CustomRoutes entry inside <CRM/> itself
// (see root/CRM.tsx's own header comment) — production must not read/write
// through the client-side anon dataProvider (RLS is `to authenticated`
// only everywhere), so this entry explicitly passes the Edge-Function-
// backed data source.
const App = () => (
  <CRM
    publicApplicationDataSource={supabasePublicApplicationDataSource}
    publicOfferPageDataSource={supabasePublicOfferPageDataSource}
    scholarshipCheckoutInvalidator={supabaseScholarshipCheckoutInvalidator}
  />
);

export default App;
