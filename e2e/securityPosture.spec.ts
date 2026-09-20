import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { expect, test } from "./fixtures";

// What a signed-in browser can and cannot do, asked of a real database by
// actually trying it.
//
// The catalog comparison in the migrations proves the grants match MAIN.
// This proves the thing the grants are FOR. A privilege audit that only
// reads pg_catalog is a description of a lock; this turns the handle.
//
// It exists because a database rebuilt from this repository used to be
// materially more permissive than production. MAIN had an
// ALTER DEFAULT PRIVILEGES applied by hand that nothing in the repository
// created, so every migration since was written as though tables arrived
// with no client access — true on MAIN, false in a rebuild. A clean room
// therefore handed any signed-in client INSERT on the outcome audit trail,
// UPDATE on immutable Application answers, writes to Contact identity, and
// EXECUTE on the five privileged functions. Both halves are now in the
// chain (20260919175000, 20260920120000) and this is the behavioural
// check that they stay there.
//
// Everything below runs as `authenticated` — the role the browser actually
// holds — or as `anon`. Never the service role, which is not a client.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54341";

const serviceRoleClient = () =>
  createClient(SUPABASE_URL, process.env.SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

const anonClient = () =>
  createClient(SUPABASE_URL, process.env.VITE_SB_PUBLISHABLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

const signedInClient = async (admin: SupabaseClient) => {
  const email = `posture-${Date.now()}@example.com`;
  const password = "posture-password-1";
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw new Error(createError.message);

  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return client;
};

// A write is denied when the database refuses it, and the refusal has to
// be one we recognise — "it errored" is not the same claim as "it was
// forbidden".
//
// 42501 insufficient privilege · 42P01 the relation is not even visible
// · 55000 the target is a view with no INSERT rule, which is a structural
// denial rather than a privilege one · PGRST301/205 PostgREST's own
// "no such relation for this role".
//
// PGRST204 is deliberately NOT in this list. It means PostgREST could not
// find the COLUMN, which happens both when the role cannot see the table
// and when the payload names a column that does not exist — so accepting
// it would let a typo masquerade as a security guarantee. Every payload
// below names real columns.
const DENIAL_CODES = ["42501", "42P01", "55000", "PGRST301", "PGRST205"];

const expectDenied = (
  result: { error: { code?: string; message?: string } | null },
  what: string,
) => {
  expect(
    result.error,
    `${what} was NOT denied — a client can do this, and on MAIN it cannot`,
  ).not.toBeNull();
  expect(
    DENIAL_CODES,
    `${what} failed for an unexpected reason: ${result.error?.code} ${result.error?.message}`,
  ).toContain(result.error!.code);
};

test.describe("a signed-in client cannot reach what only the database may write", () => {
  test("cannot forge deal outcome history", async () => {
    const admin = serviceRoleClient();
    const client = await signedInClient(admin);

    expectDenied(
      await client
        .from("deal_outcome_events")
        .insert({ opportunity_id: 1, new_outcome: "lost", source: "forged" }),
      "INSERT into deal_outcome_events",
    );
    expectDenied(
      await client.from("deal_outcome_events").select("id").limit(1),
      "SELECT from deal_outcome_events",
    );
  });

  test("cannot write Application answers, which are immutable evidence", async () => {
    const client = await signedInClient(serviceRoleClient());

    expectDenied(
      await client.from("application_responses").insert({
        application_id: 1,
        position: 1,
        question_text: "forged",
        answer_text: "forged",
      }),
      "INSERT into application_responses",
    );
    expectDenied(
      await client
        .from("application_responses")
        .update({ answer_text: "rewritten" })
        .eq("id", 1),
      "UPDATE of application_responses",
    );
    expectDenied(
      await client.from("application_responses").delete().eq("id", 1),
      "DELETE from application_responses",
    );
  });

  test("cannot write external identity rows", async () => {
    const client = await signedInClient(serviceRoleClient());

    expectDenied(
      await client.from("contact_external_identities").insert({
        contact_id: 1,
        provider: "instagram",
        external_user_id: "forged",
      }),
      "INSERT into contact_external_identities",
    );
  });

  test("cannot write the contact merge audit trail", async () => {
    const client = await signedInClient(serviceRoleClient());

    expectDenied(
      await client
        .from("contact_merges")
        .insert({ source_contact_id: 1, destination_contact_id: 2 }),
      "INSERT into contact_merges",
    );
  });

  test("cannot write contact email addresses directly", async () => {
    const client = await signedInClient(serviceRoleClient());

    expectDenied(
      await client
        .from("contact_email_addresses")
        .insert({ contact_id: 1, email: "forged@example.com" }),
      "INSERT into contact_email_addresses",
    );
  });

  test("cannot delete Stripe relations, which is how an agreed total stops being provable", async () => {
    const client = await signedInClient(serviceRoleClient());

    expectDenied(
      await client.from("contact_stripe_customers").delete().eq("id", 1),
      "DELETE from contact_stripe_customers",
    );
    expectDenied(
      await client.from("deal_stripe_plan_objects").delete().eq("id", 1),
      "DELETE from deal_stripe_plan_objects",
    );
  });

  test("cannot call the privileged functions", async () => {
    const client = await signedInClient(serviceRoleClient());

    for (const fn of [
      "merge_contacts_safely",
      "record_external_identity",
      "reconcile_sales_call_tasks",
      "reconcile_application_review_tasks",
      "seed_enrollment_onboarding",
    ]) {
      const result = await client.rpc(fn, {});
      expect(
        result.error,
        `a signed-in client could call ${fn}() — on MAIN it cannot`,
      ).not.toBeNull();
    }
  });
});

test.describe("anon reaches nothing it should not", () => {
  test("cannot read or write the protected relations", async () => {
    const client = anonClient();

    for (const relation of [
      "deal_outcome_events",
      "application_responses",
      "contact_external_identities",
      "contact_merges",
      "historical_import_records",
    ]) {
      const read = await client.from(relation).select("id").limit(1);
      expect(read.error, `anon could read ${relation}`).not.toBeNull();
    }
  });
});

test.describe("and the CRM still works", () => {
  // The other half of a privilege change: proving it took away only what
  // it meant to. A hardening that also breaks the app is not a hardening.
  test("a signed-in client retains the access the CRM is built on", async () => {
    const admin = serviceRoleClient();
    const client = await signedInClient(admin);

    for (const relation of ["contacts", "deals", "tasks", "sales_calls"]) {
      const { error } = await client.from(relation).select("id").limit(1);
      expect(error, `the CRM lost read access to ${relation}`).toBeNull();
    }

    const { data: created, error } = await client
      .from("contacts")
      .insert({
        first_name: "Posture",
        last_name: "Probe",
        email_jsonb: [],
        phone_jsonb: [],
        tags: [],
      })
      .select("id")
      .single();
    expect(error, "the CRM lost the ability to create a Contact").toBeNull();

    const { error: updateError } = await client
      .from("contacts")
      .update({ last_name: "Probed" })
      .eq("id", created!.id);
    expect(
      updateError,
      "the CRM lost the ability to update a Contact",
    ).toBeNull();
  });

  test("reads the Application answers it is meant to read", async () => {
    const client = await signedInClient(serviceRoleClient());

    const { error } = await client
      .from("application_responses")
      .select("id")
      .limit(1);
    expect(
      error,
      "authenticated lost SELECT on application_responses — it is meant to read them, only never write them",
    ).toBeNull();
  });
});

// Writing a Contact must not require the right to read identity rows.
//
// clamp_contact_last_seen() refuses a Contact a last_seen in the future and
// repairs it from real evidence — and the evidence includes
// contact_external_identities, which service_role deliberately cannot read.
// Both functions were SECURITY INVOKER, so the whole repair ran as whoever
// wrote the Contact, and the Edge Functions' own role hit
// "42501 permission denied for table contact_external_identities".
//
// It only ever fired on a last_seen strictly in the future, which is what a
// client-generated timestamp becomes by the time the database evaluates
// now() — so it was real, intermittent, and looked like nothing. A new
// person booking a call through Acuity is exactly the path that creates a
// Contact as service_role.
//
// Fixed by elevating the trigger and nothing else (20260920130000).
const FUTURE = () => new Date(Date.now() + 5 * 60_000).toISOString();
const AN_HOUR_AGO = () => new Date(Date.now() - 60 * 60_000).toISOString();

const newContact = (extra: Record<string, unknown>) => ({
  first_name: "Clamp",
  last_name: "Probe",
  email_jsonb: [],
  phone_jsonb: [],
  tags: [],
  ...extra,
});

test.describe("a Contact write does not need identity rights", () => {
  test("service_role may write a Contact whose last_seen is in the future", async () => {
    const admin = serviceRoleClient();

    const { data, error } = await admin
      .from("contacts")
      .insert(newContact({ first_seen: AN_HOUR_AGO(), last_seen: FUTURE() }))
      .select("id, last_seen")
      .single();

    expect(
      error,
      `the Edge Functions' role still cannot create a Contact: ${error?.code} ${error?.message}`,
    ).toBeNull();
    // Canonical rule: a future last_seen never survives. With no other
    // evidence for a brand-new Contact, the honest answer is null — never
    // now(), and never the future value it was handed.
    expect(data!.last_seen, "a future last_seen survived the clamp").toBeNull();
  });

  test("service_role may update a Contact to a future last_seen, and the old value stands", async () => {
    const admin = serviceRoleClient();
    const seen = AN_HOUR_AGO();

    const { data: created } = await admin
      .from("contacts")
      .insert(newContact({ first_seen: seen, last_seen: seen }))
      .select("id")
      .single();

    const { data: updated, error } = await admin
      .from("contacts")
      .update({ last_seen: FUTURE() })
      .eq("id", created!.id)
      .select("last_seen")
      .single();

    expect(error, `${error?.code} ${error?.message}`).toBeNull();
    expect(
      new Date(updated!.last_seen!).toISOString(),
      "an UPDATE with a future last_seen must fall back to the value that already stood",
    ).toBe(seen);
  });

  test("an ordinary past last_seen is still written exactly as given", async () => {
    const admin = serviceRoleClient();
    const seen = AN_HOUR_AGO();

    const { data, error } = await admin
      .from("contacts")
      .insert(newContact({ first_seen: seen, last_seen: seen }))
      .select("last_seen")
      .single();

    expect(error).toBeNull();
    expect(new Date(data!.last_seen!).toISOString()).toBe(seen);
  });

  test("authenticated is unaffected, and clamps the same way", async () => {
    const client = await signedInClient(serviceRoleClient());

    const { data, error } = await client
      .from("contacts")
      .insert(newContact({ first_seen: AN_HOUR_AGO(), last_seen: FUTURE() }))
      .select("last_seen")
      .single();

    expect(error, `${error?.code} ${error?.message}`).toBeNull();
    expect(data!.last_seen).toBeNull();
  });

  test("the elevated trigger hands the caller nothing", async () => {
    // The whole point of fixing this in the trigger rather than with a
    // grant: after the write succeeds, the role that made it still cannot
    // read a single identity row.
    const admin = serviceRoleClient();

    await admin
      .from("contacts")
      .insert(newContact({ first_seen: AN_HOUR_AGO(), last_seen: FUTURE() }));

    expectDenied(
      await admin.from("contact_external_identities").select("id").limit(1),
      "service_role SELECT on contact_external_identities",
    );
  });

  test("anon gains nothing from any of it", async () => {
    const client = anonClient();

    expectDenied(
      await client
        .from("contacts")
        .insert(newContact({ first_seen: AN_HOUR_AGO(), last_seen: FUTURE() })),
      "anon INSERT into contacts",
    );
    expectDenied(
      await client.from("contact_external_identities").select("id").limit(1),
      "anon SELECT on contact_external_identities",
    );
  });
});
