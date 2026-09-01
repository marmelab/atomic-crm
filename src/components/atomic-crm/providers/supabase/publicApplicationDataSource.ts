import type { PublicApplicationDataSource } from "../../public-application/publicApplicationDataSource";
import type {
  PublicApplicationInput,
  SubmitApplicationResult,
} from "../../public-application/submitApplication";
import type { PublicOfferContext } from "../../public-application/publicOfferContext";
import { getSupabaseClient } from "./supabase";

// Production implementation of the public /apply data source (§15). Every
// table's RLS is `to authenticated` only (see supabase/schemas/05_policies.sql),
// so an anon client-side call can never read Offers/Cohorts or write
// Contacts/Deals/Applications/Tasks directly — every operation here goes
// through the public_application Edge Function
// (supabase/functions/public_application/index.ts), which uses
// supabaseAdmin server-side, mirroring the postmark/ function's own
// "externally-triggered, validated, privileged write" shape.
//
// UNVERIFIED THIS SESSION: no local Supabase/Docker was available to run
// or smoke-test this against a real function invocation (see the slice
// report's "old Notion/Zapier path status" / "Atomic friction" notes).
// Smoke-test with `make start-supabase-functions` + curl (see
// supabase/functions/postmark/index.ts's own comment block for the
// pattern) before connecting real production data.
const invoke = async <T>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await getSupabaseClient().functions.invoke<T>(
    "public_application",
    { method: "POST", body },
  );
  if (!data || error) {
    console.error("public_application.error", error);
    throw new Error("Failed to reach the application service.");
  }
  return data;
};

export const supabasePublicApplicationDataSource: PublicApplicationDataSource =
  {
    getLivingExampleContext: () =>
      invoke<PublicOfferContext>({
        action: "context",
        offer: "living-example",
      }),
    getGroupCohortContext: (cohortId) =>
      invoke<PublicOfferContext>({
        action: "context",
        offer: "growing-yourself-up",
        cohortId,
      }),
    submitApplication: (input: PublicApplicationInput) =>
      invoke<SubmitApplicationResult>({ action: "submit", ...input }),
  };
