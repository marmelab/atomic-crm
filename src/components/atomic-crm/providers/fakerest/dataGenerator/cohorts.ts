import type { Cohort } from "../../../types";
import { GYU_OFFER_ID } from "./offers";

// Demo cohort rounds for Growing Yourself Up, using the canonical display
// naming ("Growing Yourself Up — <Round>") so the demo matches how real
// cohorts are named. Fall 2026 dates/capacity stay placeholders to
// exercise the multi-cohort UI — not production truth (see AGENTS.md /
// CLAUDE.md: no real client data in this proof slice).
export const FALL_2026_GYU_COHORT_ID = 1;
export const JANUARY_2027_GYU_COHORT_ID = 2;

export const generateCohorts = (): Cohort[] => {
  const now = new Date().toISOString();

  return [
    {
      id: FALL_2026_GYU_COHORT_ID,
      offer_id: GYU_OFFER_ID,
      name: "Growing Yourself Up — Fall 2026",
      status: "applications_open",
      applications_open_at: "2026-08-15",
      applications_close_at: "2026-09-19",
      program_start_at: "2026-09-22",
      program_end_at: "2026-11-10",
      minimum_capacity: 5,
      target_capacity: 10,
      maximum_capacity: 10,
      slack_channel_id: null,
      calendar_id: null,
      created_at: now,
      updated_at: now,
    },
    {
      // The real upcoming GYU round. Mirrors the tracked migration's own
      // January 2027 Cohort exactly: only offer_id/name/status are known,
      // and every date/capacity stays null because no source establishes
      // one. There is no November 2026 cohort — the previous placeholder
      // asserted a round that does not exist.
      id: JANUARY_2027_GYU_COHORT_ID,
      offer_id: GYU_OFFER_ID,
      name: "Growing Yourself Up — January 2027",
      status: "draft",
      applications_open_at: null,
      applications_close_at: null,
      program_start_at: null,
      program_end_at: null,
      minimum_capacity: null,
      target_capacity: null,
      maximum_capacity: null,
      slack_channel_id: null,
      calendar_id: null,
      created_at: now,
      updated_at: now,
    },
  ];
};
