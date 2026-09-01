import { CRM } from "@/components/atomic-crm/root/CRM";
import {
  authProvider,
  dataProvider,
} from "@/components/atomic-crm/providers/fakerest";
import { PublicApplicationApp } from "@/components/atomic-crm/public-application/PublicApplicationApp";
import { createDataProviderPublicApplicationDataSource } from "@/components/atomic-crm/public-application/publicApplicationDataSource";
import { memoryStore } from "ra-core";

// Native Application Intake slice (§2/§15): reuses the SAME `dataProvider`
// singleton as <CRM/> below, not a fresh instance — FakeRest's state is
// in-memory per instance, so a public submission has to land in the exact
// store the authenticated app reads from for it to actually show up in
// the Applications list / Cohort page / Dashboard within the same demo
// session (see PublicApplicationApp.tsx's own header for the routing
// side of this decision).
const publicApplicationDataSource =
  createDataProviderPublicApplicationDataSource(dataProvider);

const App = () =>
  window.location.pathname.startsWith("/apply") ? (
    <PublicApplicationApp dataSource={publicApplicationDataSource} />
  ) : (
    <CRM
      dataProvider={dataProvider}
      authProvider={authProvider}
      store={memoryStore()}
    />
  );

export default App;
