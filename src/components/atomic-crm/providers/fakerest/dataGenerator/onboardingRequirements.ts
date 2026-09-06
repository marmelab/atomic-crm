import type { OnboardingRequirementTemplate } from "../../../types";

// Contracts + Onboarding slice: hand-mirrors the real requirement catalog
// seeded by supabase/migrations/20260904220000_onboarding_requirement_seed_data.sql
// exactly (dual-implementation convention — kept in sync by hand, same as
// every other piece of this app's real config FakeRest also needs to
// emulate). Offer ids match the real linked project: 1 = The Living
// Example, 2 = Growing Yourself Up.
export const generateOnboardingRequirementTemplates =
  (): OnboardingRequirementTemplate[] => {
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
        key: "contract",
        label: "Contract signed",
        task_text_template: "Send contract to {name}",
        sort_order: 1,
        ...base,
      },
      {
        id: 2,
        offer_id: 1,
        key: "notion_access",
        label: "Notion access",
        task_text_template: "Grant {name} Notion personal session-notes access",
        sort_order: 2,
        ...base,
      },
      {
        id: 3,
        offer_id: 1,
        key: "curriculum_access",
        label: "Living Example curriculum access",
        task_text_template: "Grant {name} Living Example curriculum access",
        sort_order: 3,
        ...base,
      },
      {
        id: 4,
        offer_id: 1,
        key: "meditation_library_access",
        label: "Meditation library access",
        task_text_template: "Grant {name} meditation library access",
        sort_order: 4,
        ...base,
      },
      // Growing Yourself Up
      {
        id: 5,
        offer_id: 2,
        key: "contract",
        label: "Contract signed",
        task_text_template: "Send contract to {name}",
        sort_order: 1,
        ...base,
      },
      {
        id: 6,
        offer_id: 2,
        key: "slack_access",
        label: "Slack access",
        task_text_template: "Invite {name} to GYU Slack",
        sort_order: 2,
        ...base,
      },
      {
        id: 7,
        offer_id: 2,
        key: "calendar_access",
        label: "Google Calendar access",
        task_text_template: "Grant {name} GYU calendar access",
        sort_order: 3,
        ...base,
      },
      {
        id: 8,
        offer_id: 2,
        key: "curriculum_access",
        label: "GYU curriculum access",
        task_text_template: "Grant {name} GYU curriculum access",
        sort_order: 4,
        ...base,
      },
      {
        id: 9,
        offer_id: 2,
        key: "meditation_library_access",
        label: "Meditation library access",
        task_text_template: "Grant {name} meditation library access",
        sort_order: 5,
        ...base,
      },
    ];
  };
