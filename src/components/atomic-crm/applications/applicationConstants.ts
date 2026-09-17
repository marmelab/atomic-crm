import type { ApplicationStatus } from "../types";

// 'denied' and 'waitlist' (Phase 4H, historical-import-only — see the
// ApplicationStatus comment in types.ts) are listed here so admin filter/
// display surfaces can show them; they are never offered as a live review
// outcome (see reviewApplication.ts's separately-typed
// ApplicationReviewOutcome).
export const applicationStatuses: {
  value: ApplicationStatus;
  label: string;
}[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "needs_higher_care", label: "Needs Higher Care" },
  { value: "not_fit", label: "Not Fit" },
  { value: "do_not_engage", label: "Do Not Engage" },
  { value: "denied", label: "Denied (historical)" },
  { value: "waitlist", label: "Waitlisted (historical)" },
];

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  needs_higher_care: "Needs Higher Care",
  not_fit: "Not Fit",
  do_not_engage: "Do Not Engage",
  denied: "Denied (historical)",
  waitlist: "Waitlisted (historical)",
};

// Do Not Engage reads visibly more serious than an ordinary rejection
// (Native Applications slice, §7) — everything else stays calm/neutral.
// 'denied' reads the same as the other ordinary-rejection values since it
// IS one, just without a specific modern reason. 'waitlist' reads like
// 'pending' (outline) — it's an open/undecided historical disposition, not
// a rejection.
export const applicationStatusBadgeVariant: Record<
  ApplicationStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  approved: "default",
  needs_higher_care: "secondary",
  not_fit: "secondary",
  do_not_engage: "destructive",
  denied: "secondary",
  waitlist: "outline",
};

// Any review outcome other than "approved" means this person isn't moving
// toward a purchase for this Opportunity anymore — used by the Cohort
// capacity hooks' defensive "hasRejectedApplication" fallback (the
// Opportunity's own outcome field is the primary signal; this only matters
// if something updated Application status without going through
// reviewApplication.ts). 'denied' joins this set (it IS a rejection);
// 'waitlist' deliberately does NOT (no decision was made).
export const NON_APPROVED_TERMINAL_APPLICATION_STATUSES: ReadonlySet<ApplicationStatus> =
  new Set(["needs_higher_care", "not_fit", "do_not_engage", "denied"]);
