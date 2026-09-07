// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Same tiny in-memory fake as detectClientSessionCadenceIssues.test.ts's
// own.
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

import { assignEnrollmentExpectedSessions } from "./assignEnrollmentExpectedSessions";

const buildWindow = (overrides: Row) => ({
  offer_id: 1,
  raw_title: "1:1s",
  deleted_at: null,
  ...overrides,
});

const seedWith = (overrides: Partial<Record<string, Row[]>> = {}) =>
  createFakeDb({
    offers: [{ id: 1, client_session_acuity_appointment_type_id: "90522599" }],
    enrollments: [
      {
        id: 100,
        opportunity_id: 10,
        start_date: "2026-01-01",
        status: "active",
      },
    ],
    deals: [{ id: 10, offer_id: 1, contact_id: 1 }],
    expected_session_windows: [],
    enrollment_expected_sessions: [],
    ...overrides,
  });

// 14 weekly windows, Jan 5 through Apr 6, one 1:1s event per week — real
// cadence shape (see this slice's own report on the real observed
// weekly spacing).
const buildWeeklySeries = (count: number, startId = 1) =>
  Array.from({ length: count }, (_, i) => {
    const start = new Date(Date.UTC(2026, 0, 5 + i * 7));
    const end = new Date(Date.UTC(2026, 0, 9 + i * 7));
    return buildWindow({
      id: startId + i,
      window_start: start.toISOString().slice(0, 10),
      window_end: end.toISOString().slice(0, 10),
    });
  });

describe("assignEnrollmentExpectedSessions", () => {
  beforeEach(() => {
    fakeDb.current = seedWith();
  });
  afterAll(() => {
    vi.resetAllMocks();
  });

  it("assigns the first 3 eligible windows as Service Period 1 (ordinals 1-3)", async () => {
    fakeDb.current = seedWith({
      expected_session_windows: buildWeeklySeries(3),
    });

    const result = await assignEnrollmentExpectedSessions();
    expect(result.assignmentsCreated).toBe(3);

    const assignments = fakeDb.current!.tables.enrollment_expected_sessions;
    expect(assignments.map((a) => a.ordinal).sort()).toEqual([1, 2, 3]);
  });

  it("assigns windows 4-6 as Service Period 2, 7-9 as Period 3, 10-12 as Period 4 — exactly 12 total across a normal lifecycle", async () => {
    fakeDb.current = seedWith({
      // 14 real windows available — only 12 are ever assigned.
      expected_session_windows: buildWeeklySeries(14),
    });

    const result = await assignEnrollmentExpectedSessions();
    expect(result.assignmentsCreated).toBe(12);

    const assignments = fakeDb.current!.tables.enrollment_expected_sessions;
    expect(assignments).toHaveLength(12);
    const ordinals = assignments
      .map((a) => a.ordinal as number)
      .sort((a, b) => a - b);
    expect(ordinals).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    const periodOf = (ordinal: number) => Math.ceil(ordinal / 3);
    expect(
      assignments.filter((a) => periodOf(a.ordinal as number) === 1),
    ).toHaveLength(3);
    expect(
      assignments.filter((a) => periodOf(a.ordinal as number) === 2),
    ).toHaveLength(3);
    expect(
      assignments.filter((a) => periodOf(a.ordinal as number) === 3),
    ).toHaveLength(3);
    expect(
      assignments.filter((a) => periodOf(a.ordinal as number) === 4),
    ).toHaveLength(3);
  });

  it("ignores qualifying windows before the Enrollment's own service start date", async () => {
    fakeDb.current = seedWith({
      enrollments: [
        {
          id: 100,
          opportunity_id: 10,
          start_date: "2026-02-01",
          status: "active",
        },
      ],
      // Windows 1-4 (Jan 5/12/19/26) are before start_date — must never
      // be assigned, even though they're chronologically first. Windows
      // 5-7 (Feb 2/9/16) are on/after it and ARE eligible.
      expected_session_windows: buildWeeklySeries(7),
    });

    const result = await assignEnrollmentExpectedSessions();
    const assignedSourceIds =
      fakeDb.current!.tables.enrollment_expected_sessions.map(
        (a) => a.source_window_id,
      );
    expect(assignedSourceIds).not.toContain(1);
    expect(assignedSourceIds).not.toContain(2);
    expect(assignedSourceIds).not.toContain(3);
    expect(assignedSourceIds).not.toContain(4);
    expect(assignedSourceIds.sort()).toEqual([5, 6, 7]);
    expect(result.assignmentsCreated).toBe(3);
  });

  it("a calendar gap never creates a phantom expected window and never consumes one of the 12 slots", async () => {
    // Windows 1-3 then a real 5-week gap (Leif traveling) before window 4.
    const withGap = [
      ...buildWeeklySeries(3, 1),
      buildWindow({
        id: 4,
        window_start: "2026-05-04",
        window_end: "2026-05-08",
      }),
    ];
    fakeDb.current = seedWith({ expected_session_windows: withGap });

    const result = await assignEnrollmentExpectedSessions();
    expect(result.assignmentsCreated).toBe(4);
    const assignments = fakeDb.current!.tables.enrollment_expected_sessions;
    // Exactly 4 real windows assigned — the gap itself created nothing,
    // and none of the 4 real ones were skipped/"spent" by the gap.
    expect(assignments).toHaveLength(4);
    expect(assignments.map((a) => a.ordinal).sort()).toEqual([1, 2, 3, 4]);
  });

  it("a literal 30-day span containing 4 qualifying events still assigns only 3 to the current Service Period", async () => {
    // 4 weekly windows within one 30-day span.
    fakeDb.current = seedWith({
      expected_session_windows: buildWeeklySeries(4),
    });

    await assignEnrollmentExpectedSessions();
    const assignments = fakeDb.current!.tables.enrollment_expected_sessions;
    const periodOf = (ordinal: number) => Math.ceil(ordinal / 3);
    const period1 = assignments.filter(
      (a) => periodOf(a.ordinal as number) === 1,
    );
    expect(period1).toHaveLength(3);
    const period2 = assignments.filter(
      (a) => periodOf(a.ordinal as number) === 2,
    );
    expect(period2).toHaveLength(1);
  });

  it("a Nov 28 - Dec 2 cross-month event remains ONE expected window, never split, and belongs to exactly one Service Period", async () => {
    fakeDb.current = seedWith({
      enrollments: [
        {
          id: 100,
          opportunity_id: 10,
          start_date: "2026-11-01",
          status: "active",
        },
      ],
      expected_session_windows: [
        buildWindow({
          id: 1,
          window_start: "2026-11-28",
          window_end: "2026-12-02",
        }),
      ],
    });

    const result = await assignEnrollmentExpectedSessions();
    expect(result.assignmentsCreated).toBe(1);
    const assignments = fakeDb.current!.tables.enrollment_expected_sessions;
    expect(assignments).toHaveLength(1);
    expect(assignments[0].window_start).toBe("2026-11-28");
    expect(assignments[0].window_end).toBe("2026-12-02");
  });

  it("re-running never reassigns an existing slot's ordinal — new windows only ever append", async () => {
    fakeDb.current = seedWith({
      expected_session_windows: buildWeeklySeries(3),
    });
    await assignEnrollmentExpectedSessions();
    const firstPass = [...fakeDb.current!.tables.enrollment_expected_sessions];

    // A 4th real window appears later (e.g. a later sync run).
    fakeDb.current!.tables.expected_session_windows.push(
      buildWeeklySeries(1, 4)[0],
    );
    const second = await assignEnrollmentExpectedSessions();
    expect(second.assignmentsCreated).toBe(1);

    // The original 3 keep their exact same ordinals/ids — never
    // reassigned/renumbered.
    for (const original of firstPass) {
      const stillThere =
        fakeDb.current!.tables.enrollment_expected_sessions.find(
          (a) => a.id === original.id,
        );
      expect(stillThere).toEqual(original);
    }
    expect(fakeDb.current!.tables.enrollment_expected_sessions).toHaveLength(4);
  });

  it("re-running with no new eligible windows is a safe no-op — idempotent", async () => {
    fakeDb.current = seedWith({
      expected_session_windows: buildWeeklySeries(3),
    });
    await assignEnrollmentExpectedSessions();
    const second = await assignEnrollmentExpectedSessions();
    expect(second.assignmentsCreated).toBe(0);
    expect(fakeDb.current!.tables.enrollment_expected_sessions).toHaveLength(3);
  });

  it("never assigns a 13th window once the full 12-slot cadence is already assigned", async () => {
    fakeDb.current = seedWith({
      expected_session_windows: buildWeeklySeries(13),
    });
    await assignEnrollmentExpectedSessions();
    const second = await assignEnrollmentExpectedSessions();
    expect(second.assignmentsCreated).toBe(0);
    expect(fakeDb.current!.tables.enrollment_expected_sessions).toHaveLength(
      12,
    );
  });

  it("never assigns a soft-deleted window", async () => {
    fakeDb.current = seedWith({
      expected_session_windows: [
        buildWindow({
          id: 1,
          window_start: "2026-01-05",
          window_end: "2026-01-09",
          deleted_at: "2026-01-06T00:00:00.000Z",
        }),
      ],
    });

    const result = await assignEnrollmentExpectedSessions();
    expect(result.assignmentsCreated).toBe(0);
  });
});
