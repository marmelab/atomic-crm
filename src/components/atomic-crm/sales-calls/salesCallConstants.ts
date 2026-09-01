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

export const DEFAULT_THINKING_FOLLOW_UP_DAYS = 4;
