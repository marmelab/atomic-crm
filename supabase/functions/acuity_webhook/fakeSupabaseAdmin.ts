// Extracted verbatim from acuitySalesCallHandlers.test.ts so the Acuity
// agreement contract can drive the SAME handlers through the SAME fake
// without a second, subtly different copy of it. A near-identical fake in
// two files is exactly the shape of drift this slice exists to remove.
//
// Test-only. Nothing under index.ts imports it, so it is never bundled
// into the deployed Edge Function.
// A tiny in-memory fake covering exactly the query-builder surface these
// handlers use (select/eq/limit/maybeSingle/insert/update/single) — a
// FakeRest-style stand-in for supabaseAdmin, the same spirit as this
// codebase's own providers/fakerest/dataProvider.ts. It enforces nothing
// the database enforces — that is what the real-Postgres writer contracts
// under e2e/ are for; this one exists to exercise handler BEHAVIOUR.
export type Row = Record<string, unknown>;

export function createFakeDb(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = Object.fromEntries(
    Object.entries(seed).map(([name, rows]) => [
      name,
      rows.map((r) => ({ ...r })),
    ]),
  );
  let nextId = 1000;

  const matches = (row: Row, filters: [string, unknown][]) =>
    filters.every(([field, value]) => row[field] === value);

  const from = (table: string) => {
    tables[table] ??= [];
    const filters: [string, unknown][] = [];

    const builder = {
      eq(field: string, value: unknown) {
        filters.push([field, value]);
        return builder;
      },
      limit(_n: number) {
        return Promise.resolve({
          data: tables[table].filter((r) => matches(r, filters)),
          error: null,
        });
      },
      maybeSingle() {
        const found = tables[table].find((r) => matches(r, filters));
        return Promise.resolve({ data: found ?? null, error: null });
      },
      select(_cols?: string) {
        return builder;
      },
      insert(row: Row) {
        const created = { id: nextId++, ...row };
        tables[table].push(created);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: created, error: null }),
          }),
        };
      },
      update(patch: Row) {
        return {
          eq(field: string, value: unknown) {
            tables[table] = tables[table].map((r) =>
              r[field] === value ? { ...r, ...patch } : r,
            );
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
      // Default awaited result for a bare `.select()` with only `.eq()`
      // chained (findOrCreateContact's unfiltered select, and
      // findActiveOpportunity's eq-chain in acuityMatching.ts).
      then(resolve: (v: unknown) => void) {
        resolve({
          data: tables[table].filter((r) => matches(r, filters)),
          error: null,
        });
      },
    };
    return builder;
  };

  // A faithful stand-in for record_sales_call_cancelled()
  // (supabase/schemas/02_functions.sql) — the single transactional
  // definition of cancelling a sales call. Mirrored here rather than
  // reimplemented differently, because a fake that behaved differently
  // from the real function would hide exactly the class of bug this
  // convergence exists to prevent.
  const rpc = (name: string, args: Record<string, unknown>) => {
    // The effective-dated appointment-type resolver. Seeded from the same
    // offers/cohorts fixtures, so these tests exercise the real path the
    // handlers now take instead of the retired direct column lookup.
    if (name === "resolve_acuity_appointment_type") {
      const typeId = String(args.p_appointment_type_id);
      const offer = (tables.offers ?? []).find(
        (o) => String(o.acuity_appointment_type_id) === typeId,
      );
      if (offer) {
        return Promise.resolve({
          data: [
            {
              offer_id: offer.id,
              offer_name: offer.name,
              kind: "sales_call",
              cohort_id: null,
              resolution: "mapped",
            },
          ],
          error: null,
        });
      }
      const cohort = (tables.cohorts ?? []).find(
        (c) => String(c.acuity_appointment_type_id) === typeId,
      );
      if (cohort) {
        return Promise.resolve({
          data: [
            {
              offer_id: cohort.offer_id,
              offer_name: null,
              kind: "sales_call",
              cohort_id: cohort.id,
              resolution: "mapped",
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: [], error: null });
    }
    if (name !== "record_sales_call_cancelled") {
      return Promise.resolve({
        data: null,
        error: { message: "unknown rpc " + name },
      });
    }
    const call = (tables.sales_calls ?? []).find(
      (r) => r.id === args.p_sales_call_id,
    );
    if (!call)
      return Promise.resolve({ data: { status: "not-found" }, error: null });
    if (call.attendance === "attended") {
      return Promise.resolve({
        data: { status: "already-attended" },
        error: null,
      });
    }

    const now = new Date().toISOString();
    const alreadyCancelled = call.status === "cancelled";
    if (!alreadyCancelled) {
      call.status = "cancelled";
      call.cancelled_at = call.cancelled_at ?? now;
      (tables.sales_call_events ??= []).push({
        id: nextId++,
        sales_call_id: call.id,
        kind: "cancelled",
        occurred_at: now,
      });
    }

    for (const task of tables.tasks ?? []) {
      if (
        task.sales_call_id === call.id &&
        (task.status === "pending" || task.status === "waiting")
      ) {
        task.status = "cancelled";
      }
    }

    // The Opportunity is deliberately NOT touched. A cancelled meeting
    // says nothing about how far the sale has got, so the stage stays
    // where the sale reached — see 20260919160000.

    return Promise.resolve({
      data: {
        status: alreadyCancelled ? "already-cancelled" : "cancelled",
        opportunity_stage_unchanged: true,
      },
      error: null,
    });
  };

  return { from, rpc, tables };
}
