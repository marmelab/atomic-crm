import type { OffboardingRequirementTemplate } from "../../../types";

// Client Offboarding slice: hand-mirrors the real requirement catalog
// seeded by supabase/migrations/20260908090000_offboarding_requirement_seed_data.sql
// exactly (dual-implementation convention — kept in sync by hand, same as
// onboardingRequirements.ts). Offer ids match the real linked project:
// 1 = The Living Example, 2 = Growing Yourself Up. Curriculum and
// meditation-library access are deliberately NOT represented here —
// current business rules keep those available after completion.
export const generateOffboardingRequirementTemplates =
  (): OffboardingRequirementTemplate[] => {
    const now = new Date().toISOString();
    const base = {
      is_required: true,
      is_active: true,
      created_at: now,
      updated_at: now,
    };
    return [
      // The Living Example
      {
        id: 1,
        offer_id: 1,
        key: "notes_archived",
        label: "Session notes archived",
        task_text_template: "Move {name}'s session notes to Past Clients",
        sort_order: 1,
        ...base,
      },
      // Growing Yourself Up
      {
        id: 2,
        offer_id: 2,
        key: "slack_removed",
        label: "Slack access removed",
        task_text_template: "Remove {name} from GYU Slack",
        sort_order: 1,
        ...base,
      },
      {
        id: 3,
        offer_id: 2,
        key: "calendar_removed",
        label: "Google Calendar access removed",
        task_text_template: "Remove {name} from GYU Google Calendar",
        sort_order: 2,
        ...base,
      },
    ];
  };
