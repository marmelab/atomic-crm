import { CRM } from "@/components/atomic-crm/root/CRM";

/**
 * Application entry point
 *
 * Customize the gestionale by passing props to the CRM component:
 *  - noteStatuses
 *  - taskTypes
 *  - title
 *  - darkModeLogo / lightModeLogo
 * ... as well as all the props accepted by shadcn-admin-kit's <Admin> component.
 */
const App = () => <CRM disableTelemetry />;

export default App;
