import { createClient } from "@supabase/supabase-js";

import { expect, test } from "./fixtures";

// Completing a sale, asked of a real database by doing it.
//
// This exists because the workflow silently stopped working in production.
// Migration 20260920120000 revoked EXECUTE on seed_enrollment_onboarding()
// from every client role; handle_deal_won() — the AFTER trigger that
// creates the Enrollment — was SECURITY INVOKER and calls it, so the
// transition failed with
//
//   42501 permission denied for function seed_enrollment_onboarding
//
// WHO that blocks matters, and is easy to get wrong. An ordinary signed-in
// user was never allowed to set Won: handle_deal_saved() refuses it, because
// Won must only ever be reached by a real payment and a CRM user must not be
// able to fabricate one. The role that DOES reach it is `service_role` —
// the Stripe webhook. So the outage is not a button Leif cannot press; it
// is a client paying and the CRM failing to enroll them.
//
// Both halves are asserted below: the webhook path must work, and the
// business refusal for an ordinary user must survive the privilege fix.
//
// It runs as the REAL roles against real Postgres, because that is the only
// place a privilege boundary exists. A FakeRest test cannot fail this way,
// which is precisely how the regression reached MAIN.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54341";

// How the Stripe webhook writes: the service role key, over PostgREST.
const asWebhook = () =>
  createClient(SUPABASE_URL, process.env.SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

// A client carrying a real signed-in user's JWT — `authenticated`.
const asSignedInUser = async (email: string, password: string) => {
  const client = createClient(
    SUPABASE_URL,
    process.env.VITE_SB_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await client.auth.signInWithPassword({ email, password });
  expect(error).toBeNull();
  return client;
};

type Sale = { id: number | string };

const seedOpportunity = async (salesId: number | string, label: string) => {
  const admin = asWebhook();
  const { data: contact, error: contactError } = await admin
    .from("contacts")
    .insert({ first_name: "Won", last_name: label, sales_id: salesId })
    .select("id")
    .single();
  expect(contactError).toBeNull();

  const { data: deal, error: dealError } = await admin
    .from("deals")
    .insert({
      name: `Won ${label}`,
      contact_id: contact!.id,
      offer_id: 1,
      stage: "interested",
      amount: 4000,
      sales_id: salesId,
      index: 0,
    })
    .select("id")
    .single();
  expect(dealError).toBeNull();
  return { admin, contactId: contact!.id, dealId: deal!.id };
};

const newSale = async (
  createSales: (args: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
  }) => Promise<Sale>,
  label: string,
) => {
  const email = `won-${label}-${Date.now()}@example.com`;
  const password = "Password123!";
  const sale = await createSales({
    first_name: "Won",
    last_name: label,
    email,
    password,
  });
  return { sale, email, password };
};

test.describe("completing a sale", () => {
  test("the payment path creates the Enrollment and seeds onboarding", async ({
    createSales,
  }) => {
    // The exact write the Stripe webhook makes. This is the one that was
    // failing in production: a client pays, and nothing is created.
    const { sale } = await newSale(createSales, "paid");
    const { admin, dealId } = await seedOpportunity(sale.id, "paid");

    const { error } = await admin
      .from("deals")
      .update({ stage: "won" })
      .eq("id", dealId);
    expect(error).toBeNull();

    const { data: enrollments } = await admin
      .from("enrollments")
      .select("id")
      .eq("opportunity_id", dealId);
    expect(enrollments).toHaveLength(1);

    // And onboarding was actually seeded — the call that was denied.
    const { data: items } = await admin
      .from("enrollment_onboarding_items")
      .select("id")
      .eq("enrollment_id", enrollments![0]!.id);
    expect(items!.length).toBeGreaterThan(0);
  });

  test("a retried payment webhook does not duplicate the Enrollment or the checklist", async ({
    createSales,
  }) => {
    const { sale } = await newSale(createSales, "retry");
    const { admin, dealId } = await seedOpportunity(sale.id, "retry");

    await admin.from("deals").update({ stage: "won" }).eq("id", dealId);
    const { data: first } = await admin
      .from("enrollments")
      .select("id")
      .eq("opportunity_id", dealId);
    const { data: firstItems } = await admin
      .from("enrollment_onboarding_items")
      .select("id")
      .eq("enrollment_id", first![0]!.id);

    // Stripe retries. The guard against a second Enrollment has to survive
    // the elevation.
    const { error } = await admin
      .from("deals")
      .update({ stage: "won", description: "webhook retried" })
      .eq("id", dealId);
    expect(error).toBeNull();

    const { data: after } = await admin
      .from("enrollments")
      .select("id")
      .eq("opportunity_id", dealId);
    expect(after).toHaveLength(1);
    expect(after![0]!.id).toBe(first![0]!.id);

    const { data: afterItems } = await admin
      .from("enrollment_onboarding_items")
      .select("id")
      .eq("enrollment_id", first![0]!.id);
    expect(afterItems!.length).toBe(firstItems!.length);
  });

  test("an ordinary signed-in user still cannot fabricate a Won sale", async ({
    createSales,
  }) => {
    // Not a side effect to be tolerated — a rule to be preserved. Won means
    // somebody paid, and a CRM user editing a Deal must not be able to say
    // so. The privilege fix must not weaken this.
    const { sale, email, password } = await newSale(createSales, "direct");
    const { admin, dealId } = await seedOpportunity(sale.id, "direct");
    const user = await asSignedInUser(email, password);

    const { error } = await user
      .from("deals")
      .update({ stage: "won" })
      .eq("id", dealId);
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/only reached via a successful Stripe/i);

    const { data: enrollments } = await admin
      .from("enrollments")
      .select("id")
      .eq("opportunity_id", dealId);
    expect(enrollments).toHaveLength(0);
  });

  test("the privileged seeding function stays unreachable by a client", async ({
    createSales,
  }) => {
    // The whole reason the trigger was elevated rather than the callee
    // opened. A signed-in client must still not be able to seed a
    // checklist onto somebody's Enrollment directly.
    const { sale, email, password } = await newSale(createSales, "locked");
    const { admin, dealId } = await seedOpportunity(sale.id, "locked");
    await admin.from("deals").update({ stage: "won" }).eq("id", dealId);

    const { data: enrollment } = await admin
      .from("enrollments")
      .select("id")
      .eq("opportunity_id", dealId)
      .single();

    const user = await asSignedInUser(email, password);
    const { error } = await user.rpc("seed_enrollment_onboarding", {
      p_enrollment_id: enrollment!.id,
    });
    expect(error).not.toBeNull();
    expect(`${error?.message} ${error?.code}`).toMatch(
      /permission denied|42501|not find the function|PGRST202/i,
    );
  });

  test("an unrelated Opportunity update creates nothing", async ({
    createSales,
  }) => {
    const { sale, email, password } = await newSale(createSales, "unrelated");
    const { admin, dealId } = await seedOpportunity(sale.id, "unrelated");
    const user = await asSignedInUser(email, password);

    const { error } = await user
      .from("deals")
      .update({ description: "just a note" })
      .eq("id", dealId);
    expect(error).toBeNull();

    const { data: enrollments } = await admin
      .from("enrollments")
      .select("id")
      .eq("opportunity_id", dealId);
    expect(enrollments).toHaveLength(0);
  });
});
