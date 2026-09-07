import { describe, expect, it } from "vitest";

import type {
  ClientSession,
  ClientSessionCadenceIssue,
  EnrollmentExpectedSession,
} from "../types";
import { computeClientSessionCadenceSummary } from "./computeClientSessionCadenceSummary";

const buildSession = (
  overrides: Partial<ClientSession> = {},
): ClientSession => ({
  id: overrides.id ?? 1,
  contact_id: 1,
  enrollment_id: 1,
  offer_id: 1,
  status: "booked",
  scheduled_at: "2026-03-16T18:00:00.000Z",
  reschedule_count: 0,
  source: "acuity",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildSlot = (
  overrides: Partial<EnrollmentExpectedSession>,
): EnrollmentExpectedSession => ({
  id: overrides.id ?? 1,
  enrollment_id: 1,
  source_window_id: overrides.id ?? 1,
  ordinal: 1,
  raw_title: "1:1s",
  window_start: "2026-03-15",
  window_end: "2026-03-19",
  created_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildIssue = (
  overrides: Partial<ClientSessionCadenceIssue> = {},
): ClientSessionCadenceIssue => ({
  id: overrides.id ?? 1,
  enrollment_id: 1,
  enrollment_expected_session_id: 1,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

// "Now" fixed inside Service Period 1's own window for every test below
// (slot 1 = Mar 15-19), matching the default buildSlot() shape.
const NOW = new Date("2026-03-25T00:00:00.000Z");

describe("computeClientSessionCadenceSummary", () => {
  it("a booked session inside its assigned slot fulfills it by default — no manual completion", () => {
    const result = computeClientSessionCadenceSummary(
      {
        sessions: [buildSession({ scheduled_at: "2026-03-16T18:00:00.000Z" })],
        slots: [buildSlot({ ordinal: 1 })],
        issues: [],
      },
      NOW,
    );
    expect(result.expectedCount).toBe(1);
    expect(result.fulfilledCount).toBe(1);
    expect(result.unresolvedCount).toBe(0);
    expect(result.expectedWeeks[0].status).toBe("fulfilled");
  });

  it("a no-show session does not count as fulfilled", () => {
    const result = computeClientSessionCadenceSummary(
      {
        sessions: [
          buildSession({
            scheduled_at: "2026-03-16T18:00:00.000Z",
            no_show_at: "2026-03-17T00:00:00.000Z",
          }),
        ],
        slots: [buildSlot({ ordinal: 1 })],
        issues: [],
      },
      NOW,
    );
    expect(result.fulfilledCount).toBe(0);
    expect(result.expectedWeeks[0].status).toBe("unresolved");
  });

  it("a cancelled session does not count as fulfilled", () => {
    const result = computeClientSessionCadenceSummary(
      {
        sessions: [
          buildSession({
            status: "cancelled",
            scheduled_at: "2026-03-16T18:00:00.000Z",
          }),
        ],
        slots: [buildSlot({ ordinal: 1 })],
        issues: [],
      },
      NOW,
    );
    expect(result.fulfilledCount).toBe(0);
    expect(result.expectedWeeks[0].status).toBe("unresolved");
  });

  it("no session in a slot whose window_end has already passed is unresolved", () => {
    const result = computeClientSessionCadenceSummary(
      { sessions: [], slots: [buildSlot({ ordinal: 1 })], issues: [] },
      NOW,
    );
    expect(result.expectedWeeks[0].status).toBe("unresolved");
  });

  it("a slot that hasn't closed yet is pending, not unresolved — never flagged before Leif could still book it", () => {
    const result = computeClientSessionCadenceSummary(
      {
        sessions: [],
        slots: [
          buildSlot({
            ordinal: 1,
            window_start: "2026-03-24",
            window_end: "2026-03-28",
          }),
        ],
        issues: [],
      },
      NOW,
    );
    expect(result.expectedWeeks[0].status).toBe("pending");
    expect(result.unresolvedCount).toBe(0);
  });

  it("a resolved issue surfaces its classification instead of unresolved", () => {
    const result = computeClientSessionCadenceSummary(
      {
        sessions: [],
        slots: [buildSlot({ ordinal: 1 })],
        issues: [
          buildIssue({
            classification: "known_skip",
            resolved_at: "2026-03-20T00:00:00.000Z",
          }),
        ],
      },
      NOW,
    );
    expect(result.expectedWeeks[0].status).toBe("known_skip");
    expect(result.unresolvedCount).toBe(0);
  });

  it("a genuinely open cadence issue is unresolved even on a slot that hasn't closed by date yet", () => {
    const result = computeClientSessionCadenceSummary(
      {
        sessions: [],
        slots: [
          buildSlot({
            ordinal: 1,
            window_start: "2026-03-24",
            window_end: "2026-03-28",
          }),
        ],
        issues: [buildIssue({ resolved_at: null, classification: null })],
      },
      NOW,
    );
    expect(result.expectedWeeks[0].status).toBe("unresolved");
    expect(result.unresolvedCount).toBe(1);
  });

  it("Service Period 1 shows only ordinals 1-3 — Period 2's own slots (4-6) never clutter it", () => {
    const result = computeClientSessionCadenceSummary(
      {
        sessions: [],
        slots: [
          buildSlot({
            id: 1,
            ordinal: 1,
            window_start: "2026-03-01",
            window_end: "2026-03-05",
          }),
          buildSlot({
            id: 2,
            ordinal: 2,
            window_start: "2026-03-08",
            window_end: "2026-03-12",
          }),
          buildSlot({
            id: 3,
            ordinal: 3,
            window_start: "2026-03-15",
            window_end: "2026-03-19",
          }),
          // Period 2 — chronologically next, but not yet "current".
          buildSlot({
            id: 4,
            ordinal: 4,
            window_start: "2026-04-01",
            window_end: "2026-04-05",
          }),
          buildSlot({
            id: 5,
            ordinal: 5,
            window_start: "2026-04-08",
            window_end: "2026-04-12",
          }),
          buildSlot({
            id: 6,
            ordinal: 6,
            window_start: "2026-04-15",
            window_end: "2026-04-19",
          }),
        ],
        issues: [],
      },
      NOW,
    );
    expect(result.currentServicePeriod).toBe(1);
    expect(result.expectedCount).toBe(3);
    expect(result.expectedWeeks.map((w) => w.slot.ordinal)).toEqual([1, 2, 3]);
  });

  it("current Service Period advances to Period 2 once Period 2's own first slot has started", () => {
    const later = new Date("2026-04-05T00:00:00.000Z");
    const result = computeClientSessionCadenceSummary(
      {
        sessions: [],
        slots: [
          buildSlot({
            id: 1,
            ordinal: 1,
            window_start: "2026-03-01",
            window_end: "2026-03-05",
          }),
          buildSlot({
            id: 2,
            ordinal: 2,
            window_start: "2026-03-08",
            window_end: "2026-03-12",
          }),
          buildSlot({
            id: 3,
            ordinal: 3,
            window_start: "2026-03-15",
            window_end: "2026-03-19",
          }),
          buildSlot({
            id: 4,
            ordinal: 4,
            window_start: "2026-04-01",
            window_end: "2026-04-05",
          }),
        ],
        issues: [],
      },
      later,
    );
    expect(result.currentServicePeriod).toBe(2);
    expect(result.expectedWeeks.map((w) => w.slot.ordinal)).toEqual([4]);
  });

  it("a real 5-week calendar gap between Service Periods never inflates the current period beyond 3 slots", () => {
    const result = computeClientSessionCadenceSummary(
      {
        sessions: [],
        slots: [
          buildSlot({
            id: 1,
            ordinal: 1,
            window_start: "2026-01-05",
            window_end: "2026-01-09",
          }),
          buildSlot({
            id: 2,
            ordinal: 2,
            window_start: "2026-01-12",
            window_end: "2026-01-16",
          }),
          buildSlot({
            id: 3,
            ordinal: 3,
            window_start: "2026-01-19",
            window_end: "2026-01-23",
          }),
        ],
        issues: [],
      },
      NOW,
    );
    expect(result.expectedCount).toBe(3);
  });

  it("with no slots assigned yet, there is no current Service Period and nothing is expected", () => {
    const result = computeClientSessionCadenceSummary(
      { sessions: [], slots: [], issues: [] },
      NOW,
    );
    expect(result.currentServicePeriod).toBeNull();
    expect(result.expectedCount).toBe(0);
  });

  it("returns the earliest still-booked future session as nextSession", () => {
    const result = computeClientSessionCadenceSummary(
      {
        sessions: [
          buildSession({ id: 1, scheduled_at: "2026-04-10T18:00:00.000Z" }),
          buildSession({ id: 2, scheduled_at: "2026-04-03T18:00:00.000Z" }),
        ],
        slots: [],
        issues: [],
      },
      NOW,
    );
    expect(result.nextSession?.id).toBe(2);
  });

  it("attentionItems surfaces every open issue regardless of which Service Period its slot belongs to", () => {
    const result = computeClientSessionCadenceSummary(
      {
        sessions: [],
        // Ordinal 9 (Period 3) — well outside the current Period 1.
        slots: [
          buildSlot({
            id: 9,
            ordinal: 9,
            window_start: "2026-01-05",
            window_end: "2026-01-09",
          }),
        ],
        issues: [
          buildIssue({
            id: 9,
            enrollment_expected_session_id: 9,
            resolved_at: null,
          }),
        ],
      },
      NOW,
    );
    expect(result.expectedCount).toBe(0);
    expect(result.attentionItems).toHaveLength(1);
    expect(result.attentionItems[0].slot.id).toBe(9);
  });

  it("attentionItems never includes an already-resolved issue", () => {
    const result = computeClientSessionCadenceSummary(
      {
        sessions: [],
        slots: [buildSlot({ ordinal: 1 })],
        issues: [
          buildIssue({
            classification: "known_skip",
            resolved_at: "2026-03-20T00:00:00.000Z",
          }),
        ],
      },
      NOW,
    );
    expect(result.attentionItems).toHaveLength(0);
  });

  it("a future expected slot with no booking and no issue is Upcoming, never surfaced in attentionItems", () => {
    const result = computeClientSessionCadenceSummary(
      {
        sessions: [],
        slots: [
          buildSlot({
            ordinal: 1,
            window_start: "2026-03-24",
            window_end: "2026-03-28",
          }),
        ],
        issues: [],
      },
      NOW,
    );
    expect(result.expectedWeeks[0].status).toBe("pending");
    expect(result.attentionItems).toHaveLength(0);
  });
});
