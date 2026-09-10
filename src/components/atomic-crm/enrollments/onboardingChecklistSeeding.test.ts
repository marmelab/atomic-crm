import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type {
  Deal,
  Enrollment,
  EnrollmentOnboardingItem,
  Offer,
  OnboardingRequirementTemplate,
  Task,
} from "../types";

// Contracts + Onboarding slice: proves the FakeRest mirror of
// handle_deal_won()'s checklist-seeding extension — one required item per
// active template for the Deal's Offer, one Task per required item, both
// idempotent under a Won-transition replay (mirrors Stripe Slice B's own
// already-proven webhook-replay safety, inherited here rather than
// re-invented).
const LE_OFFER_ID = 1;
const GYU_OFFER_ID = 2;

const leTemplates = (): OnboardingRequirementTemplate[] => [
  {
    id: 1,
    offer_id: LE_OFFER_ID,
    key: "contract",
    label: "Contract signed",
    task_text_template: "Send contract to {name}",
    is_required: true,
    sort_order: 1,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 2,
    offer_id: LE_OFFER_ID,
    key: "notion_access",
    label: "Notion access",
    task_text_template: "Grant {name} Notion personal session-notes access",
    is_required: true,
    sort_order: 2,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

const gyuTemplates = (): OnboardingRequirementTemplate[] => [
  {
    id: 3,
    offer_id: GYU_OFFER_ID,
    key: "slack_access",
    label: "Slack access",
    task_text_template: "Invite {name} to GYU Slack",
    is_required: true,
    sort_order: 1,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 4,
    offer_id: GYU_OFFER_ID,
    key: "optional_extra",
    label: "Optional extra",
    task_text_template: "Do the optional extra for {name}",
    is_required: false,
    sort_order: 2,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  pricing_mode: "standard",
  id: 10,
  name: "Ada Lovelace",
  contact_id: 1,
  offer_id: LE_OFFER_ID,
  stage: "committed",
  outcome: null,
  amount: 4000,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildFixtures = (
  templates: OnboardingRequirementTemplate[],
  dealOverrides: Partial<Deal> = {},
) => {
  const offer: Offer = {
    id: dealOverrides.offer_id ?? LE_OFFER_ID,
    name: "The Living Example",
    type: "individual",
    duration: "ongoing",
    current_price: 4000,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const deal = buildDeal(dealOverrides);
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      ],
      offers: [offer],
      deals: [deal],
      enrollments: [],
      onboarding_requirement_templates: templates,
      enrollment_onboarding_items: [],
    }),
    silent: true,
    latency: 0,
  });
  return { dataProvider, deal };
};

describe("onboarding checklist seeding (handle_deal_won() FakeRest mirror)", () => {
  it("Won on an LE Deal seeds exactly the LE checklist, one Task per required item, correctly linked", async () => {
    const { dataProvider, deal } = buildFixtures(leTemplates());

    await dataProvider.update("deals", {
      id: deal.id,
      data: { stage: "won" },
      previousData: deal,
    });

    const { data: enrollments } = await dataProvider.getList<Enrollment>(
      "enrollments",
      {
        filter: { opportunity_id: deal.id },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(enrollments).toHaveLength(1);
    const enrollment = enrollments[0];

    const { data: items } =
      await dataProvider.getList<EnrollmentOnboardingItem>(
        "enrollment_onboarding_items",
        {
          filter: { enrollment_id: enrollment.id },
          pagination: { page: 1, perPage: 10 },
          sort: { field: "sort_order", order: "ASC" },
        },
      );
    expect(items.map((item) => item.requirement_key)).toEqual([
      "contract",
      "notion_access",
    ]);
    expect(items.every((item) => item.status === "pending")).toBe(true);

    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { enrollment_id: enrollment.id },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks).toHaveLength(2);
    expect(tasks[0].text).toBe("Send contract to Ada Lovelace");
    expect(tasks[0].onboarding_item_id).toBe(items[0].id);
    expect(tasks[0].type).toBe("onboarding_item");
  });

  it("optional items are seeded but never get an auto-created Task", async () => {
    const { dataProvider, deal } = buildFixtures(gyuTemplates(), {
      offer_id: GYU_OFFER_ID,
    });

    await dataProvider.update("deals", {
      id: deal.id,
      data: { stage: "won" },
      previousData: deal,
    });

    const { data: enrollments } = await dataProvider.getList<Enrollment>(
      "enrollments",
      {
        filter: { opportunity_id: deal.id },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    const { data: items } =
      await dataProvider.getList<EnrollmentOnboardingItem>(
        "enrollment_onboarding_items",
        {
          filter: { enrollment_id: enrollments[0].id },
          pagination: { page: 1, perPage: 10 },
          sort: { field: "sort_order", order: "ASC" },
        },
      );
    expect(items).toHaveLength(2);
    const optionalItem = items.find(
      (item) => item.requirement_key === "optional_extra",
    );
    expect(optionalItem?.is_required).toBe(false);

    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { enrollment_id: enrollments[0].id },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].onboarding_item_id).toBe(
      items.find((item) => item.requirement_key === "slack_access")?.id,
    );
  });

  it("a duplicate Won transition (webhook replay) never re-seeds items or Tasks", async () => {
    const { dataProvider, deal } = buildFixtures(leTemplates());

    await dataProvider.update("deals", {
      id: deal.id,
      data: { stage: "won" },
      previousData: deal,
    });
    const { data: wonDeal } = await dataProvider.getOne<Deal>("deals", {
      id: deal.id,
    });
    // A genuine re-fire of the Won transition (bounce through committed and
    // back) — the strongest real replay proof, mirroring what the real
    // Postgres trigger's ON CONFLICT DO NOTHING guarantees.
    await dataProvider.update("deals", {
      id: deal.id,
      data: { stage: "committed" },
      previousData: wonDeal,
    });
    const { data: committedDeal } = await dataProvider.getOne<Deal>("deals", {
      id: deal.id,
    });
    await dataProvider.update("deals", {
      id: deal.id,
      data: { stage: "won" },
      previousData: committedDeal,
    });

    const { data: enrollments } = await dataProvider.getList<Enrollment>(
      "enrollments",
      {
        filter: { opportunity_id: deal.id },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(enrollments).toHaveLength(1);

    const { total: itemsTotal } = await dataProvider.getList(
      "enrollment_onboarding_items",
      {
        filter: { enrollment_id: enrollments[0].id },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(itemsTotal).toBe(2);

    const { total: tasksTotal } = await dataProvider.getList("tasks", {
      filter: { enrollment_id: enrollments[0].id },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasksTotal).toBe(2);
  });
});
