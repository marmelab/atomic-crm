import type { Cohort } from "../../../types";
import { GYU_OFFER_ID } from "./offers";

// Demo-only cohort rounds for Growing Yourself Up. Dates are placeholders to
// exercise the multi-cohort UI — not production truth (see AGENTS.md /
// CLAUDE.md: no real client data in this proof slice).
export const SEPTEMBER_GYU_COHORT_ID = 1;
export const NOVEMBER_GYU_COHORT_ID = 2;

export const generateCohorts = (): Cohort[] => {
  const now = new Date().toISOString();

  return [
    {
      id: SEPTEMBER_GYU_COHORT_ID,
      offer_id: GYU_OFFER_ID,
      name: "September GYU Cohort",
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
      id: NOVEMBER_GYU_COHORT_ID,
      offer_id: GYU_OFFER_ID,
      name: "November GYU Cohort",
      status: "draft",
      applications_open_at: "2026-10-01",
      applications_close_at: "2026-11-14",
      program_start_at: "2026-11-17",
      program_end_at: "2027-01-12",
      minimum_capacity: 5,
      target_capacity: 10,
      maximum_capacity: 10,
      slack_channel_id: null,
      calendar_id: null,
      created_at: now,
      updated_at: now,
    },
  ];
};
