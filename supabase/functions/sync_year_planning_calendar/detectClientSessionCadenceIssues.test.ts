// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Same tiny in-memory fake as acuityClientSessionHandlers.test.ts's own.
type Row = Record<string, unknown>;

function createFakeDb(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = Object.fromEntries(
    Object.entries(seed).map(([name, rows]) => [
      name,
      rows.map((r) => ({ ...r })),
    ]),
  );
  let nextId = 1000;

  const matches = (row: Row, eqFilters: [string, unknown][]) =>
    eqFilters.every(([field, value]) => row[field] === value);

  const from = (table: string) => {
    tables[table] ??= [];
    const eqFilters: [string, unknown][] = [];

    const builder = {
      eq(field: string, value: unknown) {
        eqFilters.push([field, value]);
        return builder;
      },
      maybeSingle() {
        const found = tables[table].find((r) => matches(r, eqFilters));
        return Promise.resolve({ data: found ?? null, error: null });
      },
      limit(n: number) {
        return Promise.resolve({
          data: tables[table].filter((r) => matches(r, eqFilters)).slice(0, n),
          error: null,
        });
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
      then(resolve: (v: unknown) => void) {
        resolve({
          data: tables[table].filter((r) => matches(r, eqFilters)),
          error: null,
        });
      },
    };
    return builder;
  };

  return { from, tables };
}

const fakeDb = vi.hoisted(() => ({
  current: null as ReturnType<typeof createFakeDb> | null,
}));

vi.mock("../_shared/supabaseAdmin.ts", () => ({
  supabaseAdmin: {
    from: (table: string) => fakeDb.current!.from(table),
  },
}));

import { detectClientSessionCadenceIssues } from "./detectClientSessionCadenceIssues";

const NOW = new Date("2026-09-25T00:00:00.000Z");

const seedWith = (overrides: Partial<Record<string, Row[]>> = {}) =>
  createFakeDb({
    offers: [{ id: 1, client_session_acuity_appointment_type_id: "90522599" }],
    enrollments: [
      {
        id: 100,
        opportunity_id: 10,
        start_date: "2026-08-01",
        status: "active",
      },
    ],
    deals: [{ id: 10, offer_id: 1, contact_id: 1 }],
    contacts: [{ id: 1, first_name: "Ada", last_name: "Lovelace" }],
    sales: [{ id: 1, administrator: true }],
    enrollment_expected_sessions: [],
    client_sessions: [],
    client_session_cadence_issues: [],
    tasks: [],
    ...overrides,
  });

describe("detectClientSessionCadenceIssues", () => {
  beforeEach(() => {
    fakeDb.current = seedWith();
  });
  afterAll(() => {
    vi.resetAllMocks();
  });

  it("creates an issue and a resolve_client_session_cadence Task for a closed slot with no fulfilling session", async () => {
    fakeDb.current = seedWith({
      enrollment_expected_sessions: [
        {
          id: 1,
          enrollment_id: 100,
          ordinal: 1,
          window_start: "2026-09-13",
          window_end: "2026-09-17",
        },
      ],
    });

    const result = await detectClientSessionCadenceIssues(NOW);
    expect(result.issuesCreated).toBe(1);
    expect(result.tasksCreated).toBe(1);

    const issue = fakeDb.current!.tables.client_session_cadence_issues[0];
    expect(issue.enrollment_id).toBe(100);
    expect(issue.enrollment_expected_session_id).toBe(1);
    expect(issue.classification).toBeUndefined();

    const task = fakeDb.current!.tables.tasks[0];
    expect(task.type).toBe("resolve_client_session_cadence");
    // The Dashboard's Needs Attention bucket filters by sales_id — a
    // Task created with none would never appear there.
    expect(task.sales_id).toBe(1);
    expect(task.cadence_issue_id).toBe(issue.id);
    expect(task.text).toContain("Ada Lovelace");
  });

  it("a session inside the assigned slot fulfills it — no issue created", async () => {
    fakeDb.current = seedWith({
      enrollment_expected_sessions: [
        {
          id: 1,
          enrollment_id: 100,
          ordinal: 1,
          window_start: "2026-09-13",
          window_end: "2026-09-17",
        },
      ],
      client_sessions: [
        {
          id: 1,
          enrollment_id: 100,
          status: "booked",
          scheduled_at: "2026-09-15T18:00:00.000Z",
          no_show_at: null,
        },
      ],
    });

    const result = await detectClientSessionCadenceIssues(NOW);
    expect(result.issuesCreated).toBe(0);
    expect(fakeDb.current!.tables.client_session_cadence_issues).toHaveLength(
      0,
    );
  });

  it("a slot that has not closed yet is never flagged", async () => {
    fakeDb.current = seedWith({
      enrollment_expected_sessions: [
        {
          id: 1,
          enrollment_id: 100,
          ordinal: 1,
          window_start: "2026-09-27",
          window_end: "2026-10-01",
        },
      ],
    });

    const result = await detectClientSessionCadenceIssues(NOW);
    expect(result.issuesCreated).toBe(0);
  });

  it("re-running never creates a second issue or a second pending Task for the same slot", async () => {
    fakeDb.current = seedWith({
      enrollment_expected_sessions: [
        {
          id: 1,
          enrollment_id: 100,
          ordinal: 1,
          window_start: "2026-09-13",
          window_end: "2026-09-17",
        },
      ],
    });

    await detectClientSessionCadenceIssues(NOW);
    const second = await detectClientSessionCadenceIssues(NOW);
    expect(second.issuesCreated).toBe(0);
    expect(second.tasksCreated).toBe(0);
    expect(fakeDb.current!.tables.client_session_cadence_issues).toHaveLength(
      1,
    );
    expect(fakeDb.current!.tables.tasks).toHaveLength(1);
  });

  it("never creates an issue for an Offer with no client-session tracking configured", async () => {
    fakeDb.current = seedWith({
      offers: [{ id: 1, client_session_acuity_appointment_type_id: null }],
      enrollment_expected_sessions: [
        {
          id: 1,
          enrollment_id: 100,
          ordinal: 1,
          window_start: "2026-09-13",
          window_end: "2026-09-17",
        },
      ],
    });

    const result = await detectClientSessionCadenceIssues(NOW);
    expect(result.issuesCreated).toBe(0);
  });

  it("reopens an issue that was auto-resolved (classification null) but has lost fulfillment again, never creating a duplicate", async () => {
    fakeDb.current = seedWith({
      enrollment_expected_sessions: [
        {
          id: 1,
          enrollment_id: 100,
          ordinal: 1,
          window_start: "2026-09-13",
          window_end: "2026-09-17",
        },
      ],
      client_session_cadence_issues: [
        {
          id: 1,
          enrollment_id: 100,
          enrollment_expected_session_id: 1,
          classification: null,
          resolved_at: "2026-09-18T00:00:00.000Z",
        },
      ],
      tasks: [
        {
          id: 1,
          contact_id: 1,
          type: "resolve_client_session_cadence",
          cadence_issue_id: 1,
          done_date: "2026-09-18T00:00:00.000Z",
          status: "completed",
        },
      ],
    });

    const result = await detectClientSessionCadenceIssues(NOW);
    expect(result.issuesCreated).toBe(0);
    expect(fakeDb.current!.tables.client_session_cadence_issues).toHaveLength(
      1,
    );
    const issue = fakeDb.current!.tables.client_session_cadence_issues[0];
    expect(issue.resolved_at).toBeNull();

    const task = fakeDb.current!.tables.tasks[0];
    expect(task.done_date).toBeNull();
    expect(task.status).toBe("pending");
  });

  it("never touches an issue already resolved with a real human classification", async () => {
    fakeDb.current = seedWith({
      enrollment_expected_sessions: [
        {
          id: 1,
          enrollment_id: 100,
          ordinal: 1,
          window_start: "2026-09-13",
          window_end: "2026-09-17",
        },
      ],
      client_session_cadence_issues: [
        {
          id: 1,
          enrollment_id: 100,
          enrollment_expected_session_id: 1,
          classification: "known_skip",
          resolved_at: "2026-09-18T00:00:00.000Z",
        },
      ],
    });

    const result = await detectClientSessionCadenceIssues(NOW);
    expect(result.issuesCreated).toBe(0);
    const issue = fakeDb.current!.tables.client_session_cadence_issues[0];
    expect(issue.classification).toBe("known_skip");
    expect(issue.resolved_at).toBe("2026-09-18T00:00:00.000Z");
  });
});
