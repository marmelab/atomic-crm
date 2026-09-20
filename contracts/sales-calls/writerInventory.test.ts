// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import type { DataProvider } from "ra-core";

import { bookSalesCall } from "../../src/components/atomic-crm/sales-calls/bookSalesCall";
import writers from "./writers.json";

// Holds contracts/sales-calls/writers.json to reality.
//
// An inventory nobody executes is a comment that rots. Two of these
// assertions are structural — the file and the exported symbol still
// exist — and the third is the one that matters: each writer is RUN, and
// the payload it actually hands the database is compared against what the
// inventory claims it supplies.
//
// That is the assertion the scheduled_on regression needed. On 2026-09-17
// the column became NOT NULL while no writer supplied it; the inventory
// says so in `derived_by_database`, e2e/salesCallWriteContracts.spec.ts
// proves the database really does derive it, and this file proves the
// writers really do not send it. Between them there is no gap for a
// creation contract to change through unnoticed.
//
// The Edge Function writer is executed in its own runtime by
// supabase/functions/acuity_webhook/acuityWriterInventory.test.ts — Deno
// code cannot be imported here, which is the whole reason these mirrors
// exist.

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const writerById = (id: string) => {
  const found = writers.writers.find((writer) => writer.id === id);
  if (!found) throw new Error(`No writer "${id}" in the inventory`);
  return found;
};

describe("sales_calls writer inventory", () => {
  it("names at least one writer, so an emptied inventory cannot pass silently", () => {
    expect(writers.writers.length).toBeGreaterThan(0);
    expect(writers.table).toBe("public.sales_calls");
  });

  it.each(writers.writers.map((writer) => [writer.id, writer] as const))(
    "%s points at an entrypoint that still exists and still exports its symbol",
    (_id, writer) => {
      const absolute = path.join(REPO_ROOT, writer.entrypoint.file);
      expect(
        existsSync(absolute),
        `${writer.entrypoint.file} is inventoried as a Sales Call writer but does not exist`,
      ).toBe(true);

      const source = readFileSync(absolute, "utf8");
      expect(
        source.includes(`export const ${writer.entrypoint.symbol}`),
        `${writer.entrypoint.file} no longer exports ${writer.entrypoint.symbol}`,
      ).toBe(true);
    },
  );

  it.each(writers.writers.map((writer) => [writer.id, writer] as const))(
    "%s never supplies a column the database derives",
    (_id, writer) => {
      const overlap = writer.supplies.filter((column) =>
        writer.derived_by_database.includes(column),
      );
      expect(
        overlap,
        "a column cannot be both supplied by the writer and derived by the database",
      ).toEqual([]);
    },
  );
});

// A DataProvider that records what it is asked to create instead of
// creating it. Only the surface bookSalesCall actually touches.
const recordingDataProvider = () => {
  const created: { resource: string; data: Record<string, unknown> }[] = [];

  const provider = {
    getList: async (resource: string) => {
      // No existing call by acuity id, no existing booked call: the
      // fresh-creation path, which is the one under contract here.
      if (resource === "sales_calls") return { data: [], total: 0 };
      if (resource === "sales") {
        return { data: [{ id: 1, administrator: true }], total: 1 };
      }
      return { data: [], total: 0 };
    },
    getOne: async (resource: string, params: { id: unknown }) => {
      if (resource === "deals") {
        return {
          data: {
            id: params.id,
            stage: "approved",
            outcome: null,
            archived_at: null,
          },
        };
      }
      return { data: { id: params.id } };
    },
    create: async (
      resource: string,
      params: { data: Record<string, unknown> },
    ) => {
      created.push({ resource, data: params.data });
      return { data: { id: 777, ...params.data } };
    },
    update: async (
      _resource: string,
      params: { id: unknown; data: Record<string, unknown> },
    ) => ({ data: { id: params.id, ...params.data } }),
  } as unknown as DataProvider;

  return { provider, created };
};

describe("app.book_sales_call supplies exactly what the inventory says", () => {
  const writer = writerById("app.book_sales_call");

  it("sends the inventoried column set, and nothing else, on a fresh booking", async () => {
    const { provider, created } = recordingDataProvider();

    await bookSalesCall({
      dataProvider: provider,
      contactId: 1,
      contactName: "Ada Lovelace",
      opportunityId: 1,
      scheduledAt: "2026-10-29T17:00:00.000Z",
      source: "manual",
    });

    const insert = created.find((entry) => entry.resource === "sales_calls");
    expect(
      insert,
      "bookSalesCall did not create a sales_calls row",
    ).toBeDefined();

    expect(Object.keys(insert!.data).sort()).toEqual(
      [...writer.supplies].sort(),
    );
  });

  it("leaves every database-derived column to the database", async () => {
    const { provider, created } = recordingDataProvider();

    await bookSalesCall({
      dataProvider: provider,
      contactId: 1,
      contactName: "Ada Lovelace",
      opportunityId: null,
      scheduledAt: "2026-10-30T01:30:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-1",
      acuityAppointmentTypeId: "111",
      offerName: "The Living Example",
    });

    const insert = created.find((entry) => entry.resource === "sales_calls")!;
    for (const derived of writer.derived_by_database) {
      expect(
        Object.keys(insert.data),
        `bookSalesCall supplied ${derived}, which the database is supposed to derive`,
      ).not.toContain(derived);
    }
    // The one that broke production: the caller states the instant, and
    // the calendar day is not its job.
    expect(Object.keys(insert.data)).not.toContain("scheduled_on");
  });

  it("writes the booked event it owns", async () => {
    const { provider, created } = recordingDataProvider();

    await bookSalesCall({
      dataProvider: provider,
      contactId: 1,
      contactName: "Ada Lovelace",
      opportunityId: 1,
      scheduledAt: "2026-10-29T17:00:00.000Z",
      source: "manual",
    });

    expect(
      created.some(
        (entry) =>
          entry.resource === "sales_call_events" &&
          entry.data.kind === "booked",
      ),
    ).toBe(true);
  });
});
