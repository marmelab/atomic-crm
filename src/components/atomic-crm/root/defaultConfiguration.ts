import type { ConfigurationContextValue } from "./ConfigurationContext";
// Import the logo as a module asset so Vite resolves its URL relative to the
// JS chunk (import.meta.url), not the current route. A plain "./logos/..." path
// breaks on nested routes like /oauth/consent and under a deployment sub-path.
//
// Leif's real logo mark (white artwork, transparent background — designed
// for a dark backdrop). Only one variant was supplied, so it's used for both
// slots; it will render with poor contrast against the light-theme header
// background until a light-mode-optimized variant is supplied. The artwork
// itself is used as-is (not recolored/redrawn) per the brand instructions.
import leifLogoMark from "./logos/logo_leif_mark.png";

export const defaultDarkModeLogo = leifLogoMark;
export const defaultLightModeLogo = leifLogoMark;

export const defaultCurrency = "USD";

export const defaultTitle = "Leif CRM";

export const defaultCompanySectors = [
  { value: "communication-services", label: "Communication Services" },
  { value: "consumer-discretionary", label: "Consumer Discretionary" },
  { value: "consumer-staples", label: "Consumer Staples" },
  { value: "energy", label: "Energy" },
  { value: "financials", label: "Financials" },
  { value: "health-care", label: "Health Care" },
  { value: "industrials", label: "Industrials" },
  { value: "information-technology", label: "Information Technology" },
  { value: "materials", label: "Materials" },
  { value: "real-estate", label: "Real Estate" },
  { value: "utilities", label: "Utilities" },
];

// Leif's universal sales pipeline. "won" stays a real stage value (so it's
// selectable from the existing stage field, same as any other stage) but is
// excluded from the active Kanban board via `defaultDealPipelineStatuses`
// below — the same config-driven mechanism Atomic already had for this.
export const defaultDealStages = [
  { value: "interested", label: "Interested" },
  { value: "application_received", label: "Application Received" },
  { value: "approved", label: "Approved" },
  { value: "call_booked", label: "Call Booked" },
  { value: "decision", label: "Decision" },
  { value: "committed", label: "Committed" },
  { value: "won", label: "Won" },
];

export const defaultDealPipelineStatuses = ["won"];

// Deal categories are Deal/agency-specific (copywriting, print, etc.) and not
// part of Leif's model; kept as an empty list so the Settings page's
// category manager still renders without dangling agency vocabulary.
export const defaultDealCategories: { value: string; label: string }[] = [];

export const defaultNoteStatuses = [
  { value: "cold", label: "Cold", color: "#7dbde8" },
  { value: "warm", label: "Warm", color: "#e8cb7d" },
  { value: "hot", label: "Hot", color: "#e88b7d" },
  { value: "in-contract", label: "In Contract", color: "#a4e87d" },
];

// Leif's task vocabulary — what the CRM (eventually mostly automatically)
// asks the owner to do next. "other" is the catch-all default rather than
// a hidden "none", since every task should say what kind of action it is.
export const defaultTaskTypes = [
  { value: "review_application", label: "Review Application" },
  { value: "sales_call", label: "Sales Call" },
  { value: "follow_up", label: "Follow-up" },
  { value: "nurture_follow_up", label: "Nurture Follow-up" },
  { value: "check_payment", label: "Check Payment" },
  // Acuity/Sales Call Lifecycle slice: surfaces a booking that couldn't be
  // safely matched to exactly one active Opportunity, rather than burying
  // it — see sales-calls/resolveSalesCallTask.ts. Unmatched Sales Call
  // Resolution slice, human-acceptance repair: renamed from "Resolve Sales
  // Call" to plain, human-facing wording; also routes to a dedicated
  // resolution page now, never the generic Task editor (see
  // taskActionDestination.ts).
  { value: "resolve_sales_call", label: "Sales call needs matching" },
  // Contracts + Onboarding slice: auto-created by handle_deal_won() for
  // every REQUIRED onboarding checklist item (contract, access, curriculum,
  // etc.) — retires send_contract/complete_access (Aug-2026 vocabulary,
  // never wired to real logic, confirmed zero real usage) in favor of one
  // generic type whose specific action lives in the Task's own text, with
  // the durable distinction kept on the checklist item instead — see
  // enrollments/enrollmentOnboardingItems.ts.
  { value: "onboarding_item", label: "Onboarding" },
  // Client Offboarding slice: the offboarding mirror of onboarding_item
  // above — auto-created by handle_enrollment_offboarding_started() for
  // every REQUIRED offboarding checklist item (archive session notes,
  // remove Slack/Calendar access), same "generic type, specific action
  // lives in the Task's own text" reasoning.
  { value: "offboarding_item", label: "Offboarding" },
  // GYU real-infrastructure slice, human-acceptance repair pass: surfaces
  // an Opportunity left at Call Booked with no active appointment after a
  // cancellation, so it never silently strands — see
  // sales-calls/salesCallCancelledTask.ts.
  { value: "sales_call_cancelled", label: "Sales Call Cancelled" },
  // Client + Session Operations cadence correction: surfaces an active
  // Enrollment's expected 1:1 week (from Leif's real Year Planning
  // calendar) that closed with no fulfilling session — see
  // sessions/resolveClientSessionCadenceIssue.ts. Same "dedicated
  // resolution page, never the generic Task editor" pattern as
  // resolve_sales_call above.
  {
    value: "resolve_client_session_cadence",
    label: "Cadence week needs a decision",
  },
  { value: "other", label: "Other" },
];

export const defaultConfiguration: ConfigurationContextValue = {
  companySectors: defaultCompanySectors,
  currency: defaultCurrency,
  dealCategories: defaultDealCategories,
  dealPipelineStatuses: defaultDealPipelineStatuses,
  dealStages: defaultDealStages,
  noteStatuses: defaultNoteStatuses,
  taskTypes: defaultTaskTypes,
  title: defaultTitle,
  darkModeLogo: defaultDarkModeLogo,
  lightModeLogo: defaultLightModeLogo,
};
