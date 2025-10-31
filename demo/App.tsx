import { CRM } from "@/components/atomic-crm/root/CRM";
import {
  authProvider,
  dataProvider,
} from "@/components/atomic-crm/providers/fakerest";

const App = () => (
  <CRM dataProvider={dataProvider} authProvider={authProvider} />
);

export default App;
