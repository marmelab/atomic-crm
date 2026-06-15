import { CRM } from "@/components/atomic-crm/root/CRM";
import { CimaBreakQuiz } from "@/components/atomic-crm/misc/CimaBreakQuiz";

/**
 * Application entry point
 *
 * Customize Practice-CRM by passing props to the CRM component:
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
 * ... as well as all the props accepted by shadcn-admin-kit's <Admin> component.
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
  <>
    <CimaBreakQuiz />
    <CRM />
  </>
);

export default App;
