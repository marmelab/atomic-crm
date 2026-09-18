import { supabaseAdmin } from "./supabaseAdmin.ts";

// One way to record that a Stripe Customer belongs to a Contact.
//
// contact_stripe_customers is what reconciliation reads. Before this,
// stripe_checkout created a customer and wrote only the legacy
// contacts.stripe_customer_id pointer, so a customer the CRM had created
// itself would never be scanned — the money under it invisible until
// somebody confirmed it by hand. Every write path goes through here.
export const recordStripeCustomerForContact = async (params: {
  contactId: number;
  stripeCustomerId: string;
  verifiedBy: "owner_confirmed" | "checkout_session" | "webhook";
  note?: string;
}): Promise<{ status: "linked" | "already-linked" | "claimed-elsewhere" }> => {
  const { data: existingRow } = await supabaseAdmin
    .from("contact_stripe_customers")
    .select("contact_id")
    .eq("stripe_customer_id", params.stripeCustomerId)
    .maybeSingle();
  const existing = existingRow as { contact_id: number } | null;

  if (existing) {
    // A Stripe Customer belongs to exactly one person, and this never
    // moves one: that is how somebody else's money would arrive on the
    // wrong record.
    return existing.contact_id === params.contactId
      ? { status: "already-linked" }
      : { status: "claimed-elsewhere" };
  }

  const { count } = await supabaseAdmin
    .from("contact_stripe_customers")
    .select("id", { count: "exact", head: true })
    .eq("contact_id", params.contactId);
  const isFirst = (count ?? 0) === 0;

  const { error } = await supabaseAdmin
    .from("contact_stripe_customers")
    .insert({
      contact_id: params.contactId,
      stripe_customer_id: params.stripeCustomerId,
      is_primary: isFirst,
      verified_by: params.verifiedBy,
      note: params.note ?? null,
    });
  if (error) return { status: "claimed-elsewhere" };

  // The legacy column stays in step as a pointer/mirror, never as a
  // second source of truth.
  if (isFirst) {
    await supabaseAdmin
      .from("contacts")
      .update({ stripe_customer_id: params.stripeCustomerId })
      .eq("id", params.contactId);
  }

  return { status: "linked" };
};
