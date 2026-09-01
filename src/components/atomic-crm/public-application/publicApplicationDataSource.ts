import type { DataProvider } from "ra-core";

import type {
  PublicApplicationInput,
  SubmitApplicationResult,
} from "./submitApplication";
import { submitApplication } from "./submitApplication";
import type { PublicOfferContext } from "./publicOfferContext";
import {
  getGroupCohortContext,
  getLivingExampleOfferContext,
} from "./publicOfferContext";

// The boundary the public /apply pages actually depend on (§15). Two
// implementations exist:
//  - dataProviderPublicApplicationDataSource (below): FakeRest/dev — reads
//    and writes go straight through the shared dataProvider, exactly like
//    every other domain function in this app. Correct for dev/demo, where
//    FakeRest has no RLS to bypass.
//  - supabase/publicApplicationDataSource.ts: production — every table's
//    RLS is `to authenticated` only (§15), so an anon client-side
//    dataProvider call would 403 on every read and write. That
//    implementation calls the public_application Edge Function instead
//    (supabase/functions/public_application/index.ts), which uses
//    supabaseAdmin server-side.
// Each app entry (src/App.tsx, demo/App.tsx) picks the implementation
// that matches its own dataProvider/environment and passes it down — the
// page components themselves never know which one they got.
export type PublicApplicationDataSource = {
  getLivingExampleContext: () => Promise<PublicOfferContext>;
  getGroupCohortContext: (cohortId: string) => Promise<PublicOfferContext>;
  submitApplication: (
    input: PublicApplicationInput,
  ) => Promise<SubmitApplicationResult>;
};

export const createDataProviderPublicApplicationDataSource = (
  dataProvider: DataProvider,
): PublicApplicationDataSource => ({
  getLivingExampleContext: () => getLivingExampleOfferContext(dataProvider),
  getGroupCohortContext: (cohortId) =>
    getGroupCohortContext(dataProvider, cohortId),
  submitApplication: (input) => submitApplication(dataProvider, input),
});
