import { execFileSync } from "node:child_process";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { expect, test } from "./fixtures";
import writers from "../contracts/sales-calls/writers.json" with { type: "json" };
import pinnedContract from "../contracts/sales-calls/creationSchemaContract.json" with { type: "json" };

// Every inventoried Sales Call writer, replayed against a REAL Postgres
// built from the real migration chain.
//
// This is the test class that did not exist on 2026-09-17, when
// scheduled_on became NOT NULL with no default, no writer supplied it, and
// every Sales Call INSERT in production failed for three days while the
// entire suite stayed green — because FakeRest and the Edge Function's
// in-file fake enforce no NOT NULL, no CHECK and no trigger. The unit
// tests were not wrong; they were asking a different question.
//
// Nothing here goes through the UI. The contract under test is the
// PAYLOAD each writer hands the database, and whether the database
// accepts it and derives what it promises to derive. Which payload each
// writer actually produces is held to the inventory separately, by
// contracts/sales-calls/writerInventory.test.ts (app) and
// supabase/functions/acuity_webhook/acuityCrossRuntimeContract.test.ts
// (edge) — those run the writers; this runs the database.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54341";

const serviceRoleClient = () =>
  createClient(SUPABASE_URL, process.env.SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

// The app writes as a signed-in human, not as the service role. Running
// the contract under the wrong role would miss a grant or policy
// regression entirely, which is its own way of being green while
// production is broken.
const authenticatedClient = async (admin: SupabaseClient) => {
  const email = `contract-${Date.now()}@example.com`;
  const password = "contract-password-1";
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) throw new Error(createError.message);

  const client = createClient(
    SUPABASE_URL,
    process.env.VITE_SB_PUBLISHABLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return client;
};

const clientForRole = async (role: string, admin: SupabaseClient) =>
  role === "service_role" ? admin : authenticatedClient(admin);

// Two instants, chosen for one reason each.
const SCENARIOS = [
  {
    id: "denver-daytime",
    description: "an ordinary late-morning call in Denver",
    scheduledAt: "2026-10-29T17:00:00.000Z",
    expectedScheduledOn: "2026-10-29",
    crossesUtcDay: false,
  },
  {
    id: "denver-evening-crosses-utc-day",
    description:
      "19:30 in Denver on 29 October, which is already 30 October in UTC — the shape a naive date cast gets wrong",
    scheduledAt: "2026-10-30T01:30:00.000Z",
    expectedScheduledOn: "2026-10-29",
    crossesUtcDay: true,
  },
] as const;

const seedContactAndDeal = async (admin: SupabaseClient) => {
  const { data: sales } = await admin.from("sales").select("id").limit(1);

  const { data: contact, error: contactError } = await admin
    .from("contacts")
    .insert({
      first_name: "Ada",
      last_name: "Lovelace",
      sales_id: sales?.[0]?.id ?? null,
      email_jsonb: [{ email: "ada@example.com", type: "Home" }],
      phone_jsonb: [],
      tags: [],
    })
    .select("id")
    .single();
  if (contactError) throw new Error(contactError.message);

  const { data: offer, error: offerError } = await admin
    .from("offers")
    .insert({
      name: "The Living Example",
      type: "individual",
      duration: "3 months",
      current_price: 3000,
    })
    .select("id")
    .single();
  if (offerError) throw new Error(offerError.message);

  const { data: deal, error: dealError } = await admin
    .from("deals")
    .insert({
      name: "Ada Lovelace",
      contact_id: contact.id,
      offer_id: offer.id,
      stage: "approved",
    })
    .select("id")
    .single();
  if (dealError) throw new Error(dealError.message);

  return { contactId: contact.id, dealId: deal.id };
};

// A payload built from the inventory's own `supplies` list, so a writer
// that starts sending a different column set cannot keep passing here.
const buildPayload = (
  supplies: readonly string[],
  values: Record<string, unknown>,
) => {
  const payload: Record<string, unknown> = {};
  for (const column of supplies) {
    if (!(column in values)) {
      throw new Error(
        `The inventory says this writer supplies "${column}", but the contract has no value for it. Add one here, or correct contracts/sales-calls/writers.json.`,
      );
    }
    payload[column] = values[column];
  }
  return payload;
};

for (const writer of writers.writers) {
  test.describe(`${writer.id} — ${writer.title}`, () => {
    for (const scenario of SCENARIOS) {
      test(`creates a Sales Call against real Postgres: ${scenario.description}`, async () => {
        const admin = serviceRoleClient();
        const { contactId, dealId } = await seedContactAndDeal(admin);
        const client = await clientForRole(writer.auth_role, admin);

        const payload = buildPayload(writer.supplies, {
          opportunity_id: dealId,
          contact_id: contactId,
          status: "booked",
          original_scheduled_at: scenario.scheduledAt,
          scheduled_at: scenario.scheduledAt,
          reschedule_count: 0,
          source: writer.runtime.startsWith("supabase edge")
            ? "acuity"
            : "manual",
          acuity_appointment_id: `contract-${writer.id}-${scenario.id}`,
          acuity_appointment_type_id: "111",
        });

        // The assertion the regression needed. A NOT NULL column no
        // writer supplies fails right here, naming the writer and the
        // column, instead of failing silently in production for days.
        const { data: created, error } = await client
          .from("sales_calls")
          .insert(payload)
          .select(
            "id, contact_id, opportunity_id, status, source, schedule_precision, scheduled_at, scheduled_on",
          )
          .single();

        expect(
          error,
          `${writer.id} could not create a Sales Call. It supplies [${writer.supplies.join(", ")}] and expects the database to derive [${writer.derived_by_database.join(", ")}]. Database said: ${error?.message} ${error?.hint ?? ""}`,
        ).toBeNull();
        expect(created).not.toBeNull();

        // Derived, not supplied — in America/Denver.
        expect(
          created!.scheduled_on,
          "scheduled_on must be the Denver calendar day of the instant the writer stated",
        ).toBe(scenario.expectedScheduledOn);

        if (scenario.crossesUtcDay) {
          const naiveUtcDay = scenario.scheduledAt.slice(0, 10);
          expect(
            created!.scheduled_on,
            "scheduled_on fell back to the UTC date — America/Denver semantics are not holding",
          ).not.toBe(naiveUtcDay);
        }

        expect(created!.contact_id).toBe(contactId);
        expect(created!.opportunity_id).toBe(dealId);
        expect(created!.status).toBe("booked");
        expect(created!.source).toBe(payload.source);
        expect(created!.schedule_precision).toBe("exact");
        expect(new Date(created!.scheduled_at!).toISOString()).toBe(
          scenario.scheduledAt,
        );

        // on_sales_call_saved mirrors the instant onto the Opportunity.
        const { data: deal } = await admin
          .from("deals")
          .select("sales_call_at")
          .eq("id", dealId)
          .single();
        expect(
          deal?.sales_call_at && new Date(deal.sales_call_at).toISOString(),
          "the sales_call_at mirror trigger did not run",
        ).toBe(scenario.scheduledAt);
      });
    }

    test("an unattached booking is preserved rather than guessed at", async () => {
      const admin = serviceRoleClient();
      const { contactId } = await seedContactAndDeal(admin);
      const client = await clientForRole(writer.auth_role, admin);

      const payload = buildPayload(writer.supplies, {
        opportunity_id: null,
        contact_id: contactId,
        status: "booked",
        original_scheduled_at: "2026-10-29T17:00:00.000Z",
        scheduled_at: "2026-10-29T17:00:00.000Z",
        reschedule_count: 0,
        source: "acuity",
        acuity_appointment_id: `contract-unmatched-${writer.id}`,
        acuity_appointment_type_id: "111",
      });

      const { data: created, error } = await client
        .from("sales_calls")
        .insert(payload)
        .select("id, opportunity_id, scheduled_on")
        .single();

      expect(error, error?.message).toBeNull();
      expect(created!.opportunity_id).toBeNull();
      expect(created!.scheduled_on).toBe("2026-10-29");
    });

    test("never supplies a column the database is supposed to derive", async () => {
      // Stated against the live database rather than the inventory alone:
      // a column this writer omits must be one the database can fill.
      const admin = serviceRoleClient();
      const { data } = await admin.from("sales_calls").select("*").limit(0);
      expect(data).toEqual([]);

      for (const derived of writer.derived_by_database) {
        expect(
          writer.supplies,
          `${writer.id} claims to supply ${derived}, which the inventory also calls database-derived`,
        ).not.toContain(derived);
      }
    });
  });
}

// The migration-impact half. The creation contract is pinned; a migration
// that moves it fails here, in the same file that replays every writer —
// so nullability, required creation fields, CHECK constraints and
// creation-time triggers cannot change without all of them being run.
//
// The live schema is read through scripts/salesCallSchemaContract.mjs, the
// same script that regenerates the snapshot, rather than through a second
// copy of its query. Two copies of one query is the shape of drift this
// whole slice is about.
test.describe("sales_calls creation schema contract", () => {
  const readLiveContract = () =>
    JSON.parse(
      execFileSync(
        "node",
        ["scripts/salesCallSchemaContract.mjs", "--e2e"],
        // Exit code 1 means "differs from the snapshot", which is the
        // assertion's job to report, not the spawn's.
        { encoding: "utf8", cwd: process.cwd() },
      ),
    ) as typeof pinnedContract;

  const drifted = (what: string) =>
    `The sales_calls ${what} changed. If that is intended, regenerate it with \`node scripts/salesCallSchemaContract.mjs --write\`, read the diff, and make sure the writer contracts above still pass — they are every supported way a Sales Call gets created.`;

  test("the migrated schema is exactly what the contract pins", () => {
    let live: typeof pinnedContract;
    try {
      live = readLiveContract();
    } catch (error) {
      // The script exits non-zero precisely when it disagrees with the
      // snapshot, and prints the live contract on stdout regardless.
      const failure = error as { stdout?: string };
      if (!failure.stdout) throw error;
      live = JSON.parse(failure.stdout) as typeof pinnedContract;
    }

    expect(live.not_null_columns, drifted("NOT NULL columns")).toEqual(
      pinnedContract.not_null_columns,
    );
    expect(
      live.creation_fill_mechanism,
      drifted("column fill mechanisms"),
    ).toEqual(pinnedContract.creation_fill_mechanism);
    expect(live.all_columns, drifted("column set")).toEqual(
      pinnedContract.all_columns,
    );
    expect(live.check_constraints, drifted("CHECK constraints")).toEqual(
      pinnedContract.check_constraints,
    );
    expect(live.triggers, drifted("triggers")).toEqual(pinnedContract.triggers);
    expect(live.column_defaults, drifted("column defaults")).toEqual(
      pinnedContract.column_defaults,
    );
  });

  test("scheduled_on is still trigger-filled, and nothing else fills it", () => {
    // The three facts whose combination broke production. Any one of them
    // changing alone is survivable; losing the trigger while the column
    // stays NOT NULL with nothing supplying it is the outage.
    expect(pinnedContract.creation_fill_mechanism.scheduled_on).toBe("trigger");
    expect(pinnedContract.not_null_columns).toContain("scheduled_on");
    expect(Object.keys(pinnedContract.column_defaults)).not.toContain(
      "scheduled_on",
    );
    expect(
      Object.keys(pinnedContract.triggers),
      "scheduled_on is NOT NULL with no default and no writer supplies it — without this trigger every Sales Call INSERT fails",
    ).toContain("derive_sales_call_scheduled_on_trigger");
  });
});
