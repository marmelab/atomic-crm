import type Stripe from "npm:stripe@18.5.0";

import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";
import { isLiveSchedule, isLiveSubscription } from "./stripeReconcile.ts";
import { reconcileStripe } from "./stripeReconcile.ts";

// Finding a Stripe Customer the CRM has never seen, and asking before
// believing it.
//
// Reconciliation deliberately only reads customers already verified as a
// person's, which leaves one real gap: somebody with no verified customer
// at all can never be reconciled. Sam Milz is exactly that case — Leif is
// creating his subscription by hand in the Stripe dashboard, which fires
// no event this webhook subscribes to, against a customer the CRM has no
// record of. Nothing would ever find it.
//
// So discovery and authority are separated. This proposes candidates by
// email and returns what they contain; linking is a second, explicit act
// by the person looking at them. An email match never links anything on
// its own, and a customer already verified as somebody else's is never
// offered.
//
// ATOMIC HANDLES CERTAINTY. LEIF HANDLES AMBIGUITY.

export type DiscoveredCustomer = {
  stripeCustomerId: string;
  name: string | null;
  email: string | null;
  created: string;
  liveSubscriptions: number;
  liveSchedules: number;
  succeededPayments: number;
  collectedMinor: number;
  // Why this is only a candidate.
  matchedBy: "email_discovery";
};

export type DiscoveryResult = {
  contactId: number;
  alreadyVerified: string[];
  candidates: DiscoveredCustomer[];
  emailsSearched: string[];
};

const emailsFor = async (contactId: number): Promise<string[]> => {
  const { data } = await supabaseAdmin
    .from("contacts")
    .select("email_jsonb")
    .eq("id", contactId)
    .maybeSingle();
  const entries = ((data as { email_jsonb: { email: string }[] | null } | null)
    ?.email_jsonb ?? []) as { email: string }[];
  return entries
    .map((entry) => entry.email)
    .filter(
      (email) =>
        typeof email === "string" &&
        email.includes("@") &&
        !email.startsWith("le-standalone:"),
    );
};

export const discoverStripeCustomers = async (
  stripe: Stripe,
  params: { contactId: number },
): Promise<DiscoveryResult> => {
  const emails = await emailsFor(params.contactId);

  // Every customer already spoken for, by anyone. A customer verified as
  // another person's is not a candidate for this one — that is the line
  // that stops somebody's money moving onto the wrong record.
  const { data: claimedRows } = await supabaseAdmin
    .from("contact_stripe_customers")
    .select("contact_id, stripe_customer_id");
  const claimed = new Map(
    (
      (claimedRows ?? []) as {
        contact_id: number;
        stripe_customer_id: string;
      }[]
    ).map((row) => [row.stripe_customer_id, row.contact_id]),
  );

  const candidates: DiscoveredCustomer[] = [];
  const seen = new Set<string>();

  for (const email of emails) {
    let found: Stripe.ApiList<Stripe.Customer>;
    try {
      found = await stripe.customers.list({ email, limit: 50 });
    } catch {
      continue;
    }

    for (const customer of found.data) {
      if (seen.has(customer.id)) continue;
      seen.add(customer.id);
      if (claimed.has(customer.id)) continue;

      let liveSubscriptions = 0;
      let liveSchedules = 0;
      let succeededPayments = 0;
      let collectedMinor = 0;
      try {
        const [subs, scheds, intents] = await Promise.all([
          stripe.subscriptions.list({
            customer: customer.id,
            status: "all",
            limit: 50,
          }),
          stripe.subscriptionSchedules.list({
            customer: customer.id,
            limit: 50,
          }),
          stripe.paymentIntents.list({ customer: customer.id, limit: 100 }),
        ]);
        liveSubscriptions = subs.data.filter(isLiveSubscription).length;
        liveSchedules = scheds.data.filter(isLiveSchedule).length;
        for (const intent of intents.data) {
          const amount = intent.amount_received ?? 0;
          if (intent.status !== "succeeded" || amount <= 0) continue;
          succeededPayments += 1;
          collectedMinor += amount;
        }
      } catch {
        // A candidate is still worth showing even if its detail could not
        // be read; the person deciding can open Stripe.
      }

      candidates.push({
        stripeCustomerId: customer.id,
        name: customer.name ?? null,
        email: customer.email ?? null,
        created: new Date((customer.created ?? 0) * 1000).toISOString(),
        liveSubscriptions,
        liveSchedules,
        succeededPayments,
        collectedMinor,
        matchedBy: "email_discovery",
      });
    }
  }

  return {
    contactId: params.contactId,
    alreadyVerified: [...claimed.entries()]
      .filter(([, contactId]) => contactId === params.contactId)
      .map(([customerId]) => customerId),
    candidates,
    emailsSearched: emails,
  };
};

export type LinkResult =
  | { status: "linked"; delta: Awaited<ReturnType<typeof reconcileStripe>> }
  | { status: "already-linked" }
  | { status: "claimed-by-another-contact"; contactId: number }
  | { status: "error"; message: string };

// The second, deliberate act. Confirmation comes from a person, and is
// recorded as such — verified_by 'owner_confirmed', with the note saying
// how the candidate was found so the provenance is never mistaken for a
// deterministic match.
export const linkStripeCustomer = async (
  stripe: Stripe,
  params: { contactId: number; stripeCustomerId: string },
): Promise<LinkResult> => {
  const { data: existingRow } = await supabaseAdmin
    .from("contact_stripe_customers")
    .select("contact_id")
    .eq("stripe_customer_id", params.stripeCustomerId)
    .maybeSingle();
  const existing = existingRow as { contact_id: number } | null;

  if (existing) {
    return existing.contact_id === params.contactId
      ? { status: "already-linked" }
      : {
          status: "claimed-by-another-contact",
          contactId: existing.contact_id,
        };
  }

  const { count } = await supabaseAdmin
    .from("contact_stripe_customers")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", params.contactId);

  const { error } = await supabaseAdmin
    .from("contact_stripe_customers")
    .insert({
      contact_id: params.contactId,
      stripe_customer_id: params.stripeCustomerId,
      // The first one verified becomes the primary pointer.
      is_primary: (count ?? 0) === 0,
      verified_by: "owner_confirmed",
      note: "Confirmed in the CRM after being found by email in Stripe.",
    });
  if (error) return { status: "error", message: error.message };

  // Mirror the primary onto the legacy single-id column so everything
  // still reading that keeps working.
  if ((count ?? 0) === 0) {
    await supabaseAdmin
      .from("contacts")
      .update({ stripe_customer_id: params.stripeCustomerId })
      .eq("id", params.contactId);
  }

  const delta = await reconcileStripe(stripe, { contactId: params.contactId });
  return { status: "linked", delta };
};
