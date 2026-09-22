import { createClient } from "@supabase/supabase-js";
import type { DataProvider } from "ra-core";

import { expect, test } from "./fixtures";
import {
  cohortDeleteSafety,
  describeLinks,
  offerDeleteSafety,
} from "../src/components/atomic-crm/programs/programDeleteSafety";

// Deleting a Program, asked of a real database by trying it.
//
// This one cannot be answered anywhere else. Whether a delete destroys a
// person's history is decided by foreign keys, and a FakeRest test cannot
// see foreign keys at all — it has none to obey or to ignore.
//
// These once found the defect they now guard. waitlist_entries.cohort_id
// was ON DELETE CASCADE, so a round whose only link was its waiting list
// deleted cleanly and erased every membership on it — fifty-one of them
// for January 2027 — and the only thing standing in the way was one code
// path in the application. The audit that followed found five more of the
// same class on the Programme itself. 20260921180000 made all six NO
// ACTION.
//
// So two independent layers are asked here, in the order Leif meets them:
// the guard, which says what is linked and offers Archive, and the
// database, which refuses on its own no matter who is asking. Defence in
// depth means neither one alone is the reason this is safe, and a test
// that only exercised the guard could not tell the difference.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54341";

const db = () =>
  createClient(SUPABASE_URL, process.env.SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

type Client = ReturnType<typeof db>;

// The guard reads counts through a DataProvider. Here that provider talks
// to the real database, so the questions it asks — every table and column
// name in programDeleteSafety.ts — have to actually exist. They matter
// more than they look: countOf() treats a failed read as blocking, so one
// mistyped column would make every Program permanently undeletable while
// every FakeRest test still passed.
const realDataProvider = (client: Client) =>
  ({
    getList: async (
      resource: string,
      params: { filter: Record<string, unknown> },
    ) => {
      let query = client.from(resource).select("id", { count: "exact" });
      for (const [field, value] of Object.entries(params.filter)) {
        query = query.eq(field, value as never);
      }
      const { data, count, error } = await query;
      if (error) throw new Error(`${resource}: ${error.message}`);
      return { data: data ?? [], total: count ?? 0 };
    },
  }) as unknown as DataProvider;

// The group program, found by TYPE. Its name is Leif's to change.
const groupOfferId = async (client: Client) => {
  const { data, error } = await client
    .from("offers")
    .select("id")
    .eq("type", "group")
    .limit(1)
    .single();
  expect(error).toBeNull();
  return data!.id as number;
};

const makeCohort = async (client: Client, name: string) => {
  const { data, error } = await client
    .from("cohorts")
    .insert({ offer_id: await groupOfferId(client), name, status: "draft" })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data!.id as number;
};

const makeContact = async (client: Client, salesId: number | string) => {
  const { data, error } = await client
    .from("contacts")
    .insert({
      first_name: "Delete",
      last_name: "Safety",
      sales_id: salesId,
      first_seen: new Date(Date.now() - 60_000).toISOString(),
      last_seen: new Date(Date.now() - 60_000).toISOString(),
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data!.id as number;
};

// The fixture truncates between tests, sales included, so each test makes
// its own.
type CreateSales = (args: {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}) => Promise<{ id: number | string }>;

const aSale = (createSales: CreateSales, tag: string) =>
  createSales({
    first_name: "Leif",
    last_name: tag,
    email: `delete-safety-${tag}@example.com`,
    password: "password",
  });

test.describe("deleting a group round", () => {
  test("Postgres refuses to delete a round that has Opportunities", async ({
    createSales,
  }) => {
    const client = db();
    const sale = await aSale(createSales, "deals");
    const cohortId = await makeCohort(client, "Refused — has Opportunities");
    const contactId = await makeContact(client, sale.id);

    const { error: dealError } = await client.from("deals").insert({
      name: "Paid member",
      contact_id: contactId,
      offer_id: await groupOfferId(client),
      cohort_id: cohortId,
      stage: "interested",
      amount: 1400,
      sales_id: sale.id,
      index: 0,
    });
    expect(dealError).toBeNull();

    const { error } = await client.from("cohorts").delete().eq("id", cohortId);

    // 23503: foreign_key_violation. The database itself says no.
    expect(error?.code).toBe("23503");

    // And the refusal changed nothing. No cascade, no mutation: the round
    // and the person's Opportunity are both exactly as they were.
    const { data: cohort } = await client
      .from("cohorts")
      .select("id")
      .eq("id", cohortId)
      .maybeSingle();
    expect(cohort).not.toBeNull();
    const { count: deals } = await client
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("cohort_id", cohortId);
    expect(deals).toBe(1);
  });

  test("a waiting list is refused by both layers, and nothing is touched", async ({
    createSales,
  }) => {
    // The January 2027 case, at the size the test can assert exactly.
    // This is the one that used to succeed: waitlist_entries.cohort_id was
    // ON DELETE CASCADE, so a round whose only link was its waiting list
    // deleted cleanly and erased every membership on it. Fifty-one of
    // them, in the real round.
    //
    // Both layers are asked, in the order Leif meets them.
    const client = db();
    const sale = await aSale(createSales, "waitlist");
    const offerId = await groupOfferId(client);
    const cohortId = await makeCohort(client, "Fifty-one people waiting");
    const contactId = await makeContact(client, sale.id);

    const { data: entry, error: waitError } = await client
      .from("waitlist_entries")
      .insert({
        contact_id: contactId,
        offer_id: offerId,
        cohort_id: cohortId,
        status: "waiting",
        source: "manual",
      })
      .select("id, status, cohort_id, contact_id, joined_at")
      .single();
    expect(waitError).toBeNull();

    // The application layer: refuses, and says what is linked.
    const safety = await cohortDeleteSafety(realDataProvider(client), cohortId);
    expect(safety.deletable).toBe(false);
    if (!safety.deletable) {
      expect(describeLinks(safety.links)).toContain("1 people waiting");
    }

    // The database layer, asked the same question independently — because
    // the guard above is one code path, and a delete issued from a SQL
    // console or a future screen that forgets to ask would meet nothing.
    const { error } = await client.from("cohorts").delete().eq("id", cohortId);
    expect(error?.code).toBe("23503");

    // And the refusal is total: no partial mutation anywhere.
    const { data: cohortAfter } = await client
      .from("cohorts")
      .select("id, name, status")
      .eq("id", cohortId)
      .maybeSingle();
    expect(cohortAfter).not.toBeNull();

    const { data: entryAfter } = await client
      .from("waitlist_entries")
      .select("id, status, cohort_id, contact_id, joined_at")
      .eq("id", entry!.id)
      .maybeSingle();
    expect(entryAfter).toEqual(entry);

    const { data: contactAfter } = await client
      .from("contacts")
      .select("id, first_name, last_name")
      .eq("id", contactId)
      .maybeSingle();
    expect(contactAfter).not.toBeNull();
  });

  test("archiving the same round is allowed and keeps everything", async ({
    createSales,
  }) => {
    // The way out that the refusal offers. It must actually work, and it
    // must destroy nothing — otherwise "archive it instead" is advice to
    // do the thing Leif was just stopped from doing.
    const client = db();
    const sale = await aSale(createSales, "archive");
    const offerId = await groupOfferId(client);
    const cohortId = await makeCohort(client, "Archived, not deleted");
    const contactId = await makeContact(client, sale.id);

    const { data: entry } = await client
      .from("waitlist_entries")
      .insert({
        contact_id: contactId,
        offer_id: offerId,
        cohort_id: cohortId,
        status: "waiting",
        source: "manual",
      })
      .select("id, status, cohort_id, contact_id, joined_at")
      .single();

    // Exactly the patch ProgramCardMenu sends for a cohort.
    const { error } = await client
      .from("cohorts")
      .update({ status: "completed" })
      .eq("id", cohortId);
    expect(error).toBeNull();

    const { data: cohortAfter } = await client
      .from("cohorts")
      .select("id, status")
      .eq("id", cohortId)
      .single();
    expect(cohortAfter!.status).toBe("completed");

    const { data: entryAfter } = await client
      .from("waitlist_entries")
      .select("id, status, cohort_id, contact_id, joined_at")
      .eq("id", entry!.id)
      .single();
    expect(entryAfter).toEqual(entry);
  });

  test("a Program is refused too, and its rounds and waiting lists survive", async ({
    createSales,
  }) => {
    // The same audit on the Programme itself found five more cascades of
    // the same class. This exercises the two that matter most together:
    // deleting a Programme would have taken every round with it, and each
    // round's waiting list after that.
    const client = db();
    const sale = await aSale(createSales, "offer");
    const contactId = await makeContact(client, sale.id);

    const { data: offer, error: offerError } = await client
      .from("offers")
      .insert({
        name: "A Second Group Programme",
        type: "group",
        duration: "6 weeks",
        current_price: 900,
      })
      .select("id")
      .single();
    expect(offerError).toBeNull();

    const { data: cohort } = await client
      .from("cohorts")
      .insert({
        offer_id: offer!.id,
        name: "Its first round",
        status: "draft",
      })
      .select("id")
      .single();

    const { data: entry } = await client
      .from("waitlist_entries")
      .insert({
        contact_id: contactId,
        offer_id: offer!.id,
        cohort_id: cohort!.id,
        status: "waiting",
        source: "manual",
      })
      .select("id")
      .single();

    // No Opportunity exists here on purpose: deals.offer_id already
    // refused that case, which is exactly why these five went unnoticed.
    const safety = await offerDeleteSafety(realDataProvider(client), offer!.id);
    expect(safety.deletable).toBe(false);
    if (!safety.deletable) {
      const links = describeLinks(safety.links);
      expect(links).toContain("1 rounds");
      expect(links).toContain("1 people waiting");
    }

    const { error } = await client.from("offers").delete().eq("id", offer!.id);
    expect(error?.code).toBe("23503");

    const { data: cohortAfter } = await client
      .from("cohorts")
      .select("id")
      .eq("id", cohort!.id)
      .maybeSingle();
    expect(cohortAfter).not.toBeNull();

    const { data: entryAfter } = await client
      .from("waitlist_entries")
      .select("id")
      .eq("id", entry!.id)
      .maybeSingle();
    expect(entryAfter).not.toBeNull();

    // Cleanup, in the order the constraints now demand.
    await client.from("waitlist_entries").delete().eq("id", entry!.id);
    await client.from("cohorts").delete().eq("id", cohort!.id);
    await client.from("offers").delete().eq("id", offer!.id);
  });

  // The catalogue-wide version of this question — "does ANY foreign key to
  // a Programme or a round still destroy a fact about a person?" — is not
  // asked here. PostgREST cannot read pg_constraint, and adding a database
  // function so a test could would mean widening production surface for a
  // test's convenience. It is asserted instead where it belongs and where
  // it is stronger: 20260921180000 ends with the exact allowed set, so a
  // new table hung off offers or cohorts with a convenient ON DELETE
  // CASCADE fails the migration chain rather than being discovered by
  // somebody losing rows.

  test("the guard asks the real schema questions it can actually answer", async () => {
    // Every table and column programDeleteSafety.ts reads, read for real.
    // countOf() reports 1 on a failed read so that "we could not check"
    // never reads as "safe to delete" — which means a single wrong column
    // name would block every deletion forever, invisibly, with all the
    // FakeRest tests still green. An empty round must come back deletable.
    const client = db();
    const cohortId = await makeCohort(client, "Nothing linked to it");

    const safety = await cohortDeleteSafety(realDataProvider(client), cohortId);
    expect(safety).toEqual({ deletable: true });
  });

  test("an empty round deletes cleanly", async () => {
    const client = db();
    const cohortId = await makeCohort(client, "A mis-click");

    const { error } = await client.from("cohorts").delete().eq("id", cohortId);
    expect(error).toBeNull();

    const { data } = await client
      .from("cohorts")
      .select("id")
      .eq("id", cohortId)
      .maybeSingle();
    expect(data).toBeNull();
  });

  test("a round with invitations sent is refused by both layers", async ({
    createSales,
  }) => {
    // An invitation batch is a record of Leif having asked people to
    // book. waitlist_invitation_batches.cohort_id has no delete rule, so
    // here the database agrees with the guard — and the test exists to
    // notice if that ever stops being true.
    const client = db();
    await aSale(createSales, "batches");
    const offerId = await groupOfferId(client);
    const cohortId = await makeCohort(client, "Already invited");

    const { error: batchError } = await client
      .from("waitlist_invitation_batches")
      .insert({ offer_id: offerId, cohort_id: cohortId, status: "prepared" });
    expect(batchError).toBeNull();

    const safety = await cohortDeleteSafety(realDataProvider(client), cohortId);
    expect(safety.deletable).toBe(false);
    if (!safety.deletable) {
      expect(describeLinks(safety.links)).toContain("1 invitations sent");
    }

    const { error } = await client.from("cohorts").delete().eq("id", cohortId);
    expect(error?.code).toBe("23503");
  });
});
