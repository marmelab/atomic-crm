// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Same tiny in-memory fake as acuityClientSessionHandlers.test.ts's own
// (duplicated per this directory's documented convention), extended with
// `.is()` since syncExpectedSessionWindows uses it for
// "deleted_at is null".
type Row = Record<string, unknown>;

function createFakeDb(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = Object.fromEntries(
    Object.entries(seed).map(([name, rows]) => [
      name,
      rows.map((r) => ({ ...r })),
    ]),
  );
  let nextId = 1000;

  const matches = (
    row: Row,
    eqFilters: [string, unknown][],
    isFilters: [string, null][],
  ) =>
    eqFilters.every(([field, value]) => row[field] === value) &&
    isFilters.every(([field]) => row[field] == null);

  const from = (table: string) => {
    tables[table] ??= [];
    const eqFilters: [string, unknown][] = [];
    const isFilters: [string, null][] = [];

    const builder = {
      eq(field: string, value: unknown) {
        eqFilters.push([field, value]);
        return builder;
      },
      is(field: string, value: null) {
        isFilters.push([field, value]);
        return builder;
      },
      limit(_n: number) {
        return Promise.resolve({
          data: tables[table].filter((r) => matches(r, eqFilters, isFilters)),
          error: null,
        });
      },
      maybeSingle() {
        const found = tables[table].find((r) =>
          matches(r, eqFilters, isFilters),
        );
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
      then(resolve: (v: unknown) => void) {
        resolve({
          data: tables[table].filter((r) => matches(r, eqFilters, isFilters)),
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

import {
  isExpectedWindowTitle,
  syncExpectedSessionWindows,
} from "./syncExpectedSessionWindows";

const CALENDAR_ID =
  "2ba71af4a7aeab20c68778c8b9bb90349db53e131f8d5bf1b3eb31a73e04c8c8@group.calendar.google.com";

const buildIcs = (events: string[]) =>
  "BEGIN:VCALENDAR\r\nVERSION:2.0\r\n" + events.join("") + "END:VCALENDAR\r\n";

const allDayEvent = (
  uid: string,
  summary: string,
  start: string,
  end: string,
) =>
  [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `SUMMARY:${summary}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    "END:VEVENT",
  ].join("\r\n") + "\r\n";

describe("isExpectedWindowTitle", () => {
  it("matches every real observed 1:1 title variant", () => {
    expect(isExpectedWindowTitle("1:1s")).toBe(true);
    expect(isExpectedWindowTitle("1:1 week")).toBe(true);
    expect(isExpectedWindowTitle("1:1")).toBe(true);
    expect(isExpectedWindowTitle("1:1s add")).toBe(true);
  });

  it("does not match this same calendar's other real event titles", () => {
    expect(isExpectedWindowTitle("Th Group")).toBe(false);
    expect(isExpectedWindowTitle("4 Corners")).toBe(false);
    expect(isExpectedWindowTitle("Personal Group")).toBe(false);
    expect(isExpectedWindowTitle("Groups")).toBe(false);
  });
});

describe("syncExpectedSessionWindows", () => {
  beforeEach(() => {
    fakeDb.current = createFakeDb({ expected_session_windows: [] });
  });
  afterAll(() => {
    vi.resetAllMocks();
  });

  it("creates a new expected_session_windows row for a real 1:1s event", async () => {
    const ics = buildIcs([
      allDayEvent("evt-1", "1:1s", "20260913", "20260917"),
    ]);
    const result = await syncExpectedSessionWindows({
      icsText: ics,
      offerId: 1,
      calendarId: CALENDAR_ID,
    });
    expect(result.upserted).toBe(1);
    const rows = fakeDb.current!.tables.expected_session_windows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      offer_id: 1,
      external_event_id: "evt-1",
      window_start: "2026-09-13",
      window_end: "2026-09-17",
    });
  });

  it("never creates a window for a non-1:1 event on the same calendar", async () => {
    const ics = buildIcs([
      allDayEvent("evt-th", "Th Group", "20260106", "20260107"),
    ]);
    const result = await syncExpectedSessionWindows({
      icsText: ics,
      offerId: 1,
      calendarId: CALENDAR_ID,
    });
    expect(result.upserted).toBe(0);
    expect(fakeDb.current!.tables.expected_session_windows).toHaveLength(0);
  });

  it("a duplicate sync (same event id, ran twice) never duplicates the window — updates in place", async () => {
    const ics = buildIcs([
      allDayEvent("evt-2", "1:1s", "20260920", "20260924"),
    ]);
    await syncExpectedSessionWindows({
      icsText: ics,
      offerId: 1,
      calendarId: CALENDAR_ID,
    });
    const second = await syncExpectedSessionWindows({
      icsText: ics,
      offerId: 1,
      calendarId: CALENDAR_ID,
    });
    expect(second.upserted).toBe(1);
    expect(fakeDb.current!.tables.expected_session_windows).toHaveLength(1);
  });

  it("soft-deletes a previously-synced window whose event disappeared from a later sync", async () => {
    const firstIcs = buildIcs([
      allDayEvent("evt-3", "1:1s", "20260927", "20261001"),
    ]);
    await syncExpectedSessionWindows({
      icsText: firstIcs,
      offerId: 1,
      calendarId: CALENDAR_ID,
    });

    const laterIcs = buildIcs([]);
    const result = await syncExpectedSessionWindows({
      icsText: laterIcs,
      offerId: 1,
      calendarId: CALENDAR_ID,
    });
    expect(result.softDeleted).toBe(1);
    expect(
      fakeDb.current!.tables.expected_session_windows[0].deleted_at,
    ).toBeTruthy();
  });

  it("counts a recurring (RRULE) event as skipped rather than mis-expanding it", async () => {
    const ics = buildIcs([]).replace(
      "END:VCALENDAR",
      [
        "BEGIN:VEVENT",
        "UID:evt-recurring",
        "SUMMARY:1:1s",
        "DTSTART;VALUE=DATE:20260101",
        "DTEND;VALUE=DATE:20260105",
        "RRULE:FREQ=WEEKLY",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n"),
    );
    const result = await syncExpectedSessionWindows({
      icsText: ics,
      offerId: 1,
      calendarId: CALENDAR_ID,
    });
    expect(result.skippedRecurring).toBe(1);
    expect(fakeDb.current!.tables.expected_session_windows).toHaveLength(0);
  });
});
