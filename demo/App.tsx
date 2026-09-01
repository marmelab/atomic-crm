import { CRM } from "@/components/atomic-crm/root/CRM";
import {
  authProvider,
  dataProvider,
} from "@/components/atomic-crm/providers/fakerest";
import { createDataProviderPublicApplicationDataSource } from "@/components/atomic-crm/public-application/publicApplicationDataSource";
import { memoryStore } from "ra-core";

// Native Application Intake (§15), acceptance-repair pass: built from the
// SAME `dataProvider` singleton passed to <CRM/> below (not a fresh
// instance) — FakeRest's state is in-memory per instance, so a public
// submission has to land in the exact store the authenticated app reads
// from. /apply/* itself is registered inside <CRM/> as an unauthenticated
// CustomRoutes entry (see root/CRM.tsx's own header comment) rather than a
// separate top-level app/router, so submitting on /apply/... and then
// navigating (even via a typed URL, since it's a same-document hash
// change) to check the Applications/Opportunities/Tasks lists never
// crosses a full page reload — the actual bug the previous, separately-
// routed PublicApplicationApp had.
const publicApplicationDataSource =
  createDataProviderPublicApplicationDataSource(dataProvider);

const App = () => (
  <CRM
    dataProvider={dataProvider}
    authProvider={authProvider}
    store={memoryStore()}
    publicApplicationDataSource={publicApplicationDataSource}
  />
);

export default App;
