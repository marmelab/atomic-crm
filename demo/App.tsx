import { CRM } from "@/atomic-crm/root/CRM";
import { authProvider, dataProvider } from "@/atomic-crm/providers/fakerest";

const App = () => (
  <CRM dataProvider={dataProvider} authProvider={authProvider} />
);

export default App;
