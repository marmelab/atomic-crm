// Sales-process vocabulary for the Complete Sales Call action — same plain-
// data convention as deals/opportunityConstants.ts (no config/settings
// indirection; this describes Leif's own process, not per-tenant branding).
// ownerDecisions/prospectDecisions are already established there and are
// reused as-is by completeSalesCallOutcome.ts and its dialog.
import type { SalesCallAttendance } from "../types";

export const salesCallAttendances: {
  value: SalesCallAttendance;
  label: string;
}[] = [
  { value: "attended", label: "Attended" },
  { value: "no_show", label: "No-show" },
];

// What the human is actually asked after a call: the two ATTENDANCE
// outcomes plus cancellation, which is not an attendance at all — the call
// never happened, so there is nobody to have attended or missed it. Kept
// separate from salesCallAttendances (the database vocabulary) so
// "cancelled" can never be written into sales_calls.attendance.
export type SalesCallOutcomeChoice = SalesCallAttendance | "cancelled";

export const salesCallOutcomeChoices: {
  value: SalesCallOutcomeChoice;
  label: string;
}[] = [
  { value: "attended", label: "Call happened" },
  { value: "no_show", label: "No-show" },
  { value: "cancelled", label: "Cancelled" },
];

export const DEFAULT_THINKING_FOLLOW_UP_DAYS = 4;
