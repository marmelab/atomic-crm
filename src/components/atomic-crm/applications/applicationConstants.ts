import type { ApplicationStatus } from "../types";

export const applicationStatuses: {
  value: ApplicationStatus;
  label: string;
}[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "needs_higher_care", label: "Needs Higher Care" },
  { value: "not_fit", label: "Not Fit" },
  { value: "do_not_engage", label: "Do Not Engage" },
];

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  needs_higher_care: "Needs Higher Care",
  not_fit: "Not Fit",
  do_not_engage: "Do Not Engage",
};

// Do Not Engage reads visibly more serious than an ordinary rejection
// (Native Applications slice, §7) — everything else stays calm/neutral.
export const applicationStatusBadgeVariant: Record<
  ApplicationStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  approved: "default",
  needs_higher_care: "secondary",
  not_fit: "secondary",
  do_not_engage: "destructive",
};

// Any review outcome other than "approved" means this person isn't moving
// toward a purchase for this Opportunity anymore — used by the Cohort
// capacity hooks' defensive "hasRejectedApplication" fallback (the
// Opportunity's own outcome field is the primary signal; this only matters
// if something updated Application status without going through
// reviewApplication.ts).
export const NON_APPROVED_TERMINAL_APPLICATION_STATUSES: ReadonlySet<ApplicationStatus> =
  new Set(["needs_higher_care", "not_fit", "do_not_engage"]);
