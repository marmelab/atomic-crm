import { getSupabaseClient } from "../providers/supabase/supabase";

// "Sync Stripe" for one person.
//
// The browser never holds a Stripe key. supabase.functions.invoke sends
// the signed-in user's own JWT, and the Edge Function — which is where the
// Stripe credentials live — verifies it before doing anything. The only
// customer it can ever touch is the stripe_customer_id already stored on
// the Contact whose id is passed, so this cannot be used to walk somebody
// else's Stripe account.
export type SyncStripeResult = {
  status: "linked" | "already-linked" | "none-found" | "needs-review" | "error";
  message: string;
};

export const syncStripeForContact = async (
  contactId: number | string,
): Promise<SyncStripeResult> => {
  const numericId = Number(contactId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return { status: "error", message: "That person has no usable id." };
  }

  const { data, error } = await getSupabaseClient().functions.invoke<{
    status?: string;
    delta?: {
      schedulesLinked: number;
      subscriptionsLinked: number;
      alreadyLinked: number;
      noStripePlan: number;
      ambiguous: { contactId: number; candidates: string[] }[];
      errors: string[];
    };
  }>(`stripe_webhook?action=reconcile&contactId=${numericId}`, {
    method: "POST",
    body: {},
  });

  if (error || !data?.delta) {
    return {
      status: "error",
      message: "Could not reach Stripe just now — nothing was changed.",
    };
  }

  const delta = data.delta;

  if (delta.errors.length > 0) {
    return { status: "error", message: delta.errors[0] };
  }
  if (delta.ambiguous.length > 0) {
    // Fails closed rather than picking one, and says so.
    return {
      status: "needs-review",
      message:
        "Stripe match needs review — more than one plan or Opportunity could be the right one.",
    };
  }
  if (delta.schedulesLinked > 0 || delta.subscriptionsLinked > 0) {
    return { status: "linked", message: "Stripe synced — plan linked." };
  }
  if (delta.alreadyLinked > 0) {
    return {
      status: "already-linked",
      message: "Stripe synced — already up to date.",
    };
  }
  return {
    status: "none-found",
    message: "No Stripe subscription or schedule found for this person.",
  };
};
