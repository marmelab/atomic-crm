import type {
  ClientSession,
  ClientSessionCadenceIssue,
  EnrollmentExpectedSession,
} from "../types";

export type ExpectedWeekStatus =
  | "fulfilled"
  | "unresolved"
  | "pending"
  | "known_skip"
  | "rescheduled"
  | "missed_ghosted";

export type ExpectedWeekSummary = {
  slot: EnrollmentExpectedSession;
  status: ExpectedWeekStatus;
  fulfillingSession: ClientSession | null;
  issue: ClientSessionCadenceIssue | null;
};

export type ClientSessionCadenceSummary = {
  // 1-4, or null when the Enrollment has no assigned slots at all yet
  // (calendar sync/assignment hasn't run, or nothing eligible exists).
  currentServicePeriod: number | null;
  // The CURRENT Service Period's own slots only (up to 3) — real
  // calendar-derived windows, sequenced by the Service Period model
  // (Client + Session Operations correction: 12 total session
  // opportunities grouped into 4 Service Periods of exactly 3, defined
  // by the chronological sequence of qualifying Year Planning windows —
  // never a 30/31-day calendar month).
  expectedWeeks: ExpectedWeekSummary[];
  expectedCount: number;
  fulfilledCount: number;
  unresolvedCount: number;
  // The earliest still-booked (non-cancelled, non-no-show) session
  // strictly in the future, or null — independent of the current period.
  nextSession: ClientSession | null;
  // ClientShow's own "Needs attention" section (UX correction) —
  // EVERY still-open cadence issue for this Enrollment, regardless of
  // which Service Period its slot belongs to, so it stays in lockstep
  // with the Dashboard's own Needs Attention Task-based surface (the
  // same durable underlying issue, never two separate alert systems).
  attentionItems: ExpectedWeekSummary[];
};

const isFulfilling = (
  session: ClientSession,
  slot: Pick<EnrollmentExpectedSession, "window_start" | "window_end">,
) => {
  if (session.status === "cancelled" || session.no_show_at) return false;
  const scheduledAt = new Date(session.scheduled_at);
  return (
    scheduledAt >= new Date(slot.window_start) &&
    scheduledAt < new Date(slot.window_end)
  );
};

// 1-3 -> Period 1, 4-6 -> Period 2, 7-9 -> Period 3, 10-12 -> Period 4.
// Pure derived arithmetic — a Service Period number is never stored,
// only ever computed from a slot's own frozen ordinal.
const servicePeriodOf = (ordinal: number) => Math.ceil(ordinal / 3);

const computeSlotStatus = (
  slot: EnrollmentExpectedSession,
  sessions: ClientSession[],
  issues: ClientSessionCadenceIssue[],
  now: Date,
): ExpectedWeekSummary => {
  const fulfillingSession =
    sessions.find((session) => isFulfilling(session, slot)) ?? null;
  if (fulfillingSession) {
    return { slot, status: "fulfilled", fulfillingSession, issue: null };
  }

  const issue =
    issues.find(
      (candidate) =>
        String(candidate.enrollment_expected_session_id) === String(slot.id),
    ) ?? null;
  if (issue?.resolved_at && issue.classification) {
    return {
      slot,
      status: issue.classification,
      fulfillingSession: null,
      issue,
    };
  }
  // An issue that's still open is ALWAYS actionable, regardless of
  // whether the slot has technically closed by date yet (exception
  // state-machine correction) — ensureCadenceIssueOpen.ts only ever
  // creates/reopens one in response to a real, deterministic event (a
  // No-show), so its mere existence is itself the fact that matters, not
  // the calendar date.
  if (issue && issue.resolved_at == null) {
    return { slot, status: "unresolved", fulfillingSession: null, issue };
  }

  const slotHasClosed = new Date(slot.window_end) <= now;
  return {
    slot,
    status: slotHasClosed ? "unresolved" : "pending",
    fulfillingSession: null,
    issue,
  };
};

// The pure comparison behind the Enrollment page's cadence display
// (Client + Session Operations correction) — reads each Enrollment's own
// frozen, sequentially-assigned enrollment_expected_sessions slots
// (never a raw calendar-month filter over the shared
// expected_session_windows) — a booked/non-cancelled/non-no-show session
// inside a slot fulfills it BY DEFAULT, no manual completion step. An
// already-closed slot with nothing fulfilling it is "unresolved" until
// Leif classifies it; a slot that hasn't closed yet is merely "pending"
// (Leif may still book it), never flagged as a problem.
//
// "Current Service Period" = the highest-numbered period (1-4) whose own
// FIRST slot has already started (window_start <= now) — i.e. the period
// currently in progress, or the most recently begun one if all four have
// started, or Period 1 (shown with future/"Upcoming" slots) if the
// Enrollment hasn't reached its first slot's start date yet. This is a
// deliberate, explicit design choice (not dictated verbatim by the
// business rule) — see this slice's own report.
export const computeClientSessionCadenceSummary = (
  {
    sessions,
    slots,
    issues,
  }: {
    sessions: ClientSession[];
    slots: EnrollmentExpectedSession[];
    issues: ClientSessionCadenceIssue[];
  },
  now: Date = new Date(),
): ClientSessionCadenceSummary => {
  const sortedSlots = [...slots].sort((a, b) => a.ordinal - b.ordinal);

  let currentServicePeriod: number | null = null;
  if (sortedSlots.length > 0) {
    currentServicePeriod = 1;
    for (let period = 1; period <= 4; period++) {
      const firstOrdinalOfPeriod = (period - 1) * 3 + 1;
      const firstSlotOfPeriod = sortedSlots.find(
        (slot) => slot.ordinal === firstOrdinalOfPeriod,
      );
      if (
        firstSlotOfPeriod &&
        new Date(firstSlotOfPeriod.window_start) <= now
      ) {
        currentServicePeriod = period;
      }
    }
  }

  const periodSlots =
    currentServicePeriod == null
      ? []
      : sortedSlots.filter(
          (slot) => servicePeriodOf(slot.ordinal) === currentServicePeriod,
        );

  const expectedWeeks = periodSlots.map((slot) =>
    computeSlotStatus(slot, sessions, issues, now),
  );

  const fulfilledCount = expectedWeeks.filter(
    (week) => week.status === "fulfilled",
  ).length;
  const unresolvedCount = expectedWeeks.filter(
    (week) => week.status === "unresolved",
  ).length;

  const nextSession =
    sessions
      .filter(
        (session) =>
          session.status !== "cancelled" &&
          !session.no_show_at &&
          new Date(session.scheduled_at) > now,
      )
      .sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() -
          new Date(b.scheduled_at).getTime(),
      )[0] ?? null;

  // Every still-open issue, regardless of period — defensively re-checks
  // fulfillment (rather than trusting resolved_at alone) so a session
  // booked directly into the slot by some other path never leaves a
  // stale, already-fulfilled item sitting in Attention.
  const attentionItems: ExpectedWeekSummary[] = issues
    .filter((issue) => issue.resolved_at == null)
    .map((issue): ExpectedWeekSummary | null => {
      const slot = sortedSlots.find(
        (candidate) =>
          String(candidate.id) === String(issue.enrollment_expected_session_id),
      );
      if (!slot) return null;
      const fulfillingSession =
        sessions.find((session) => isFulfilling(session, slot)) ?? null;
      if (fulfillingSession) return null;
      return { slot, status: "unresolved", fulfillingSession: null, issue };
    })
    .filter((item): item is ExpectedWeekSummary => item != null)
    .sort((a, b) => a.slot.ordinal - b.slot.ordinal);

  return {
    currentServicePeriod,
    expectedWeeks,
    expectedCount: expectedWeeks.length,
    fulfilledCount,
    unresolvedCount,
    nextSession,
    attentionItems,
  };
};
