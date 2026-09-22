import { createClient } from "@supabase/supabase-js";
import type { DataProvider } from "ra-core";

import { expect, test } from "./fixtures";
import {
  cohortDeleteSafety,
  describeLinks,
} from "../src/components/atomic-crm/programs/programDeleteSafety";

// Deleting a Program, asked of a real database by trying it.
//
// This one cannot be answered anywhere else. Whether a delete destroys a
// person's history is decided by foreign keys, and the foreign keys here
// do not all say the same thing:
//
//   deals.cohort_id                       no delete rule  -> Postgres refuses
//   applications.intended_cohort_id       no delete rule  -> Postgres refuses
//   waitlist_invitation_batches.cohort_id no delete rule  -> Postgres refuses
//   waitlist_entries.cohort_id            ON DELETE CASCADE -> Postgres OBEYS
//
// That last line is the whole reason programDeleteSafety.ts exists. A
// round whose only link is its waiting list is one the database will
// happily delete, taking every waiting person with it — fifty-one of them
// for January 2027. Nothing below that layer would stop it, and a
// FakeRest test cannot see it at all, because FakeRest has no foreign
// keys to obey or to ignore.
//
// So both halves are proven here against real Postgres: what the database
// does on its own, and that the guard in front of it gives the same
// answer about the same rows.

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

  test("Postgres DOES cascade a waiting list away, which is why the app refuses first", async ({
    createSales,
  }) => {
    // The dangerous case, demonstrated rather than asserted from the
    // schema file. waitlist_entries.cohort_id is ON DELETE CASCADE, so a
    // round whose only link is its waiting list deletes cleanly and takes
    // every waiting person with it.
    const client = db();
    const sale = await aSale(createSales, "waitlist");
    const offerId = await groupOfferId(client);
    const cohortId = await makeCohort(client, "Fifty-one people waiting");
    const contactId = await makeContact(client, sale.id);

    const { error: waitError } = await client.from("waitlist_entries").insert({
      contact_id: contactId,
      offer_id: offerId,
      cohort_id: cohortId,
      status: "waiting",
      source: "manual",
    });
    expect(waitError).toBeNull();

    // First: the guard, asked about these real rows, refuses.
    const safety = await cohortDeleteSafety(realDataProvider(client), cohortId);
    expect(safety.deletable).toBe(false);
    if (!safety.deletable) {
      expect(describeLinks(safety.links)).toContain("1 people waiting");
    }

    // Then: what would have happened without it. The delete succeeds and
    // the membership is gone — so the guard is not decoration over a
    // database that was going to refuse anyway.
    const { error } = await client.from("cohorts").delete().eq("id", cohortId);
    expect(error).toBeNull();

    const { count } = await client
      .from("waitlist_entries")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", contactId);
    expect(count).toBe(0);

    // The person themselves survives — the cascade takes the membership,
    // not the human.
    const { data: contact } = await client
      .from("contacts")
      .select("id")
      .eq("id", contactId)
      .maybeSingle();
    expect(contact).not.toBeNull();
  });

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
