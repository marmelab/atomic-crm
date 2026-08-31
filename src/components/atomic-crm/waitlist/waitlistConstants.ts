import type { WaitlistEntryStatus } from "../types";

export const waitlistEntryStatuses: {
  value: WaitlistEntryStatus;
  label: string;
}[] = [
  { value: "waiting", label: "Waiting" },
  { value: "invited", label: "Invited" },
  { value: "converted", label: "Converted" },
  { value: "removed", label: "Removed" },
];

export const waitlistEntryStatusLabels: Record<WaitlistEntryStatus, string> = {
  waiting: "Waiting",
  invited: "Invited",
  converted: "Converted",
  removed: "Removed",
};

export const waitlistEntryStatusBadgeVariant: Record<
  WaitlistEntryStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  waiting: "outline",
  invited: "default",
  converted: "secondary",
  removed: "secondary",
};

// "Active" mirrors the DB's partial unique index predicate exactly
// (status IN ('waiting','invited')) — the only two statuses that count
// toward duplicate prevention, program waitlist counts, and Person-page
// "currently waiting" displays.
export const ACTIVE_WAITLIST_STATUSES: ReadonlySet<WaitlistEntryStatus> =
  new Set(["waiting", "invited"]);
