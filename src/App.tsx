import { CRM } from "@/atomic-crm/root/CRM";
import { authProvider, dataProvider } from "@/atomic-crm/providers/fakerest";

const useFakeRest =
  import.meta.env.VITE_USE_FAKEREST === "true" ||
  import.meta.env.VITE_IS_DEMO === "true";

const App = useFakeRest
  ? () => <CRM dataProvider={dataProvider} authProvider={authProvider} />
  : () => <CRM />;

export default App;
