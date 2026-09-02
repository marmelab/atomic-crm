import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { memoryStore, type AuthProvider } from "ra-core";

import { CRM } from "./CRM";
import { Notification } from "@/components/admin/notification";
import { testI18nProvider } from "@/components/atomic-crm/providers/commons/i18nProvider";
import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import { createDataProviderPublicApplicationDataSource } from "@/components/atomic-crm/public-application/publicApplicationDataSource";
import { createCrmDb } from "@/test/StoryWrapper";
import type { Offer } from "@/components/atomic-crm/types";

// GitHub Pages deep-link repair: every existing /apply/* routing test
// (CRM.publicApplicationRouting.test.tsx) renders <CRM/> inside react-
// router's <MemoryRouter initialEntries={["/apply/living-example"]}>.
// MemoryRouter treats that string as an opaque pathname — it has no concept
// of "hash vs. non-hash" at all, so those tests pass identically whether the
// real app would actually be reachable at a real browser's plain
// "/apply/living-example" or only at "/#/apply/living-example". They gave
// zero evidence either way, which is exactly how the real bug (GitHub
// Pages, this app's actual deploy target, serves a plain "/apply/living-
// example" link as a hard 404 — see public/404.html and
// src/deepLinkRedirect.ts) went undetected.
//
// This test renders the SAME <CRM/> tree with NO Router wrapper at all —
// ra-core's AdminRouter creates its own real HashRouter in that case (see
// node_modules/ra-core/dist/routing/AdminRouter.js: "Creates a Router
// unless the app is already inside an existing router... HashRouter by
// default"), the exact router the real deployed app mounts with. Setting
// window.location.hash / pathname before render and asserting on what
// actually renders is sensitive to real browser hash-vs-pathname semantics
// in a way MemoryRouter structurally cannot be — the "appropriate layer"
// for this specific class of bug.
const unauthenticatedProvider: AuthProvider = {
  checkAuth: async () => {
    throw new Error("not authenticated");
  },
  checkError: async () => undefined,
  login: async () => undefined,
  logout: async () => undefined,
  getIdentity: async () => {
    throw new Error("not authenticated");
  },
};

const livingExample: Offer = {
  id: 1,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  max_active_clients: 12,
  is_active: true,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const buildDataProvider = () =>
  createDataProvider({
    db: createCrmDb({
      contacts: [],
      contact_notes: [],
      offers: [livingExample],
      offer_payment_options: [],
      cohorts: [],
      applications: [],
      enrollments: [],
      deals: [],
      tasks: [],
      waitlist_entries: [],
    } as any),
    silent: true,
    latency: 0,
  });

const renderCrmWithNoRouter = (
  dataProvider: ReturnType<typeof buildDataProvider>,
) => {
  const publicApplicationDataSource =
    createDataProviderPublicApplicationDataSource(dataProvider);
  return render(
    <CRM
      dataProvider={dataProvider}
      authProvider={unauthenticatedProvider}
      i18nProvider={testI18nProvider}
      store={memoryStore()}
      disableTelemetry
      publicApplicationDataSource={publicApplicationDataSource}
      layout={({ children }) => (
        <>
          {children}
          <Notification />
        </>
      )}
    />,
  );
};

describe("Public /apply route reachability under the app's REAL (non-Memory) HashRouter", () => {
  afterEach(() => {
    // Same-document navigation back to a clean slate so the next test's
    // initial hash/pathname assignment isn't polluted by this one.
    window.history.replaceState(null, "", "/");
  });

  it("a hash-based deep link (what public/404.html redirects a plain link to) reaches the Living Example form", async () => {
    await page.viewport(1280, 900);
    window.location.hash = "#/apply/living-example";

    const screen = await renderCrmWithNoRouter(buildDataProvider());

    await expect
      .element(screen.getByLabelText("First name"))
      .toBeInTheDocument();
  });

  it("a plain (non-hash) pathname alone does NOT reach the form — proving why the GitHub Pages deep-link shim is required, not optional", async () => {
    await page.viewport(1280, 900);
    // No hash set — history.pushState mirrors exactly what a real browser's
    // address bar shows immediately after following a plain
    // ".../apply/living-example" link, before any 404.html redirect runs.
    window.history.pushState(null, "", "/apply/living-example");

    const screen = await renderCrmWithNoRouter(buildDataProvider());

    // The real HashRouter has nothing at an empty hash to route to the
    // application form with, so it falls through to whatever the app's
    // default/root screen is instead — never the applicant's "First name"
    // field. This is the exact real-browser failure this slice's audit
    // found, reproduced directly (not inferred) at this layer.
    await expect
      .element(screen.getByLabelText("First name"))
      .not.toBeInTheDocument();
  });
});
