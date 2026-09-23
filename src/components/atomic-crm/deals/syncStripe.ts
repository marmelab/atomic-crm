import { getSupabaseClient } from "../providers/supabase/supabase";

// "Sync Stripe" for one person.
//
// The browser never holds a Stripe key. supabase.functions.invoke sends
// the signed-in user's own JWT, and the Edge Function — which is where the
// Stripe credentials live — verifies it before doing anything. The only
// customers it can ever touch are the ones already VERIFIED as belonging
// to the Contact whose id is passed, so this cannot be used to walk
// somebody else's Stripe account, and an unverified customer found by
// matching an email address is never reachable this way at all.
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
      paymentsIngested: number;
      planObjectsRecorded: number;
      planObjectsUpdated: number;
      agreedTermsDerived: number;
      needsReview: { contactId: number; reason: string }[];
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
  // A review raised by the sweep outranks the good news, because it is
  // the thing a human has to act on.
  if (delta.needsReview?.length > 0) {
    return { status: "needs-review", message: delta.needsReview[0].reason };
  }

  // What actually changed, said as a list rather than as one headline.
  //
  // It used to pick a single sentence, and the one it landed on for an
  // already-linked person was "no new Stripe records" — read, reasonably,
  // as "Stripe has nothing for this client". It never meant that. It
  // meant this run found nothing NEW, which is a statement about the run
  // and says nothing about what Stripe holds. A sync does several
  // different jobs and now reports each of them.
  const changes: string[] = [];
  if (delta.subscriptionsLinked > 0 || delta.schedulesLinked > 0) {
    changes.push("new plan linked");
  }
  if (delta.agreedTermsDerived > 0) changes.push("agreed total from Stripe");
  if (delta.paymentsIngested > 0) {
    const count = delta.paymentsIngested;
    changes.push(`${count} payment${count === 1 ? "" : "s"} recorded`);
  }
  if (delta.planObjectsRecorded > 0 || delta.planObjectsUpdated > 0) {
    changes.push("plan details updated");
  }

  if (changes.length > 0) {
    return {
      status: "linked",
      message: `Stripe synced — ${changes.join(", ")}.`,
    };
  }
  if (delta.alreadyLinked > 0) {
    return {
      status: "already-linked",
      message: "Stripe synced — already up to date with Stripe.",
    };
  }
  return {
    status: "none-found",
    message: "Stripe synced — no Stripe records found for this person.",
  };
};

// "Sync Stripe" for everybody, from the Dashboard.
//
// Same shape as the per-person sync above and the same safety: the browser
// holds no Stripe key and no cron secret, and sends nothing but the
// signed-in user's own JWT. There is deliberately no parameter — the
// server decides both whether this caller may sweep the account (an
// administrator on their own `sales` row, read server-side) and what the
// sweep touches. What comes back is counts, never Stripe identifiers.
export type SyncAllStripeResult = {
  status: "synced" | "not-authorized" | "error";
  message: string;
};

export const syncStripeForEveryone = async (): Promise<SyncAllStripeResult> => {
  const { data, error } = await getSupabaseClient().functions.invoke<{
    status?: string;
    customersChecked?: number;
    updatesApplied?: number;
    needsReview?: number;
    ambiguous?: number;
    errors?: number;
  }>("stripe_webhook?action=reconcile-all", { method: "POST", body: {} });

  if (error || data?.status !== "synced") {
    // Refused is a different answer from unreachable, and saying so is
    // what stops somebody retrying a button that will never work for them.
    const status = (error as { context?: { status?: number } })?.context
      ?.status;
    if (status === 401 || status === 403) {
      return {
        status: "not-authorized",
        message: "Only an account administrator can sync all of Stripe.",
      };
    }
    return {
      status: "error",
      message: "Could not reach Stripe just now — nothing was changed.",
    };
  }

  const updates = data.updatesApplied ?? 0;
  const checked = data.customersChecked ?? 0;
  const attention = (data.needsReview ?? 0) + (data.ambiguous ?? 0);

  const parts = [
    updates > 0
      ? `${updates} update${updates === 1 ? "" : "s"} applied`
      : "nothing new to apply",
    `${checked} Stripe customer${checked === 1 ? "" : "s"} checked`,
  ];
  if (attention > 0) {
    parts.push(
      `${attention} need${attention === 1 ? "s" : ""} your review on their client page`,
    );
  }

  return { status: "synced", message: `Stripe synced — ${parts.join(", ")}.` };
};

// Finding a Stripe Customer the CRM has never seen, for somebody who has
// none verified at all.
//
// Reconciliation only ever reads verified customers, which is what stops
// it attaching the wrong person's money — and which leaves a real gap when
// Leif creates a subscription by hand in the Stripe dashboard against a
// customer the CRM has no record of. Sam Milz is that case. Nothing fires,
// nothing matches, and the plan stays invisible forever.
//
// So the CRM proposes and the human decides. These two calls are that
// split, and an email match never links anything on its own.
export type DiscoveredStripeCustomer = {
  stripeCustomerId: string;
  name: string | null;
  email: string | null;
  created: string;
  liveSubscriptions: number;
  liveSchedules: number;
  succeededPayments: number;
  collectedMinor: number;
};

export const discoverStripeCustomers = async (
  contactId: number | string,
): Promise<DiscoveredStripeCustomer[]> => {
  const numericId = Number(contactId);
  if (!Number.isInteger(numericId) || numericId <= 0) return [];

  const { data, error } = await getSupabaseClient().functions.invoke<{
    candidates?: DiscoveredStripeCustomer[];
  }>(`stripe_webhook?action=discover&contactId=${numericId}`, {
    method: "POST",
    body: {},
  });
  if (error || !data?.candidates) return [];
  return data.candidates;
};

export const linkStripeCustomer = async (
  contactId: number | string,
  stripeCustomerId: string,
): Promise<SyncStripeResult> => {
  const numericId = Number(contactId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return { status: "error", message: "That person has no usable id." };
  }

  const { data, error } = await getSupabaseClient().functions.invoke<{
    status?: string;
    contactId?: number;
  }>(
    `stripe_webhook?action=link_customer&contactId=${numericId}&customerId=${encodeURIComponent(stripeCustomerId)}`,
    { method: "POST", body: {} },
  );

  if (error || !data?.status) {
    return {
      status: "error",
      message: "Could not reach Stripe just now — nothing was changed.",
    };
  }
  if (data.status === "claimed-by-another-contact") {
    // Refused rather than moved. Two people cannot own one customer.
    return {
      status: "needs-review",
      message:
        "That Stripe customer is already linked to somebody else. Nothing was changed.",
    };
  }
  if (data.status === "already-linked") {
    return { status: "already-linked", message: "Already linked." };
  }
  if (data.status === "error") {
    return { status: "error", message: "Could not link that Stripe customer." };
  }
  return { status: "linked", message: "Stripe customer linked and synced." };
};
