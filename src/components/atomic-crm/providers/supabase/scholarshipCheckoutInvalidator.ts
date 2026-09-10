import type {
  InvalidateStaleCheckoutResult,
  ScholarshipCheckoutInvalidator,
} from "../../deals/scholarshipCheckoutInvalidator";
import { getSupabaseClient } from "./supabase";

// Production implementation — mirrors publicOfferPageDataSource.ts's own
// `invoke` shape exactly. Best-effort: a failure here is reported back
// (never thrown/swallowed) so the caller can surface it distinctly rather
// than pretending the stale Checkout Session was actually invalidated —
// see scholarshipCheckoutInvalidator.ts's own header for why this is
// deliberately non-blocking and not the invariant's real backstop.
export const supabaseScholarshipCheckoutInvalidator: ScholarshipCheckoutInvalidator =
  async (dealId) => {
    try {
      const { data, error } =
        await getSupabaseClient().functions.invoke<InvalidateStaleCheckoutResult>(
          "stripe_invalidate_checkout",
          { method: "POST", body: { dealId } },
        );
      if (error || !data) {
        console.error("stripe_invalidate_checkout.error", error);
        return { status: "failed" };
      }
      return data;
    } catch (error) {
      console.error("stripe_invalidate_checkout.error", error);
      return { status: "failed" };
    }
  };
