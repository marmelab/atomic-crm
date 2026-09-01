import { BrowserRouter, Route, Routes } from "react-router";

import type { PublicApplicationDataSource } from "./publicApplicationDataSource";
import { LivingExampleApplicationPage } from "./LivingExampleApplicationPage";
import { GrowingYourselfUpApplicationPage } from "./GrowingYourselfUpApplicationPage";

// The public /apply tree's own root (§2/§15) — entirely outside
// <Admin requireAuth>, so it needs no auth, exposes no admin
// functionality, and carries none of ra-core's context (no Store, no
// AuthProvider, no DataProviderContext).
//
// Routing note: <CRM>'s own router (ra-core's AdminRouter) only creates a
// HashRouter when it isn't already inside a Router
// (node_modules/ra-core/src/routing/AdminRouter.tsx: "Creates a Router
// unless the app is already inside existing router"). Each app entry
// (src/App.tsx, demo/App.tsx) renders EITHER this component OR <CRM/> —
// never both in the same tree — so <CRM/> is always mounted with no
// ancestor Router and keeps its existing HashRouter behavior completely
// unchanged. This component's own BrowserRouter is real path-based
// routing (/apply/..., no #), which is what lets these be genuine
// shareable/bookmarkable public URLs matching §2's example shape — the
// operational consequence (a static-host SPA-fallback rewrite is needed
// for a cold/refreshed load of a real path in production, since the rest
// of the app's HashRouter never needed one) is called out in the slice
// report rather than solved here, since no real deployment target is
// connected this session.
export const PublicApplicationApp = ({
  dataSource,
}: {
  dataSource: PublicApplicationDataSource;
}) => (
  <BrowserRouter>
    <Routes>
      <Route
        path={LivingExampleApplicationPage.path}
        element={<LivingExampleApplicationPage dataSource={dataSource} />}
      />
      <Route
        path={GrowingYourselfUpApplicationPage.path}
        element={<GrowingYourselfUpApplicationPage dataSource={dataSource} />}
      />
    </Routes>
  </BrowserRouter>
);
