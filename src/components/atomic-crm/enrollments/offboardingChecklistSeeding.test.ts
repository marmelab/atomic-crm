import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type {
  Deal,
  Enrollment,
  EnrollmentOffboardingItem,
  Offer,
  OffboardingRequirementTemplate,
  Task,
} from "../types";

// Client Offboarding slice: proves the FakeRest mirror of
// handle_enrollment_offboarding_started()'s checklist-seeding — one item
// per active template for the Deal's Offer, one Task per REQUIRED item
// only, snapshotted at the moment status genuinely transitions
// active -> offboarding. §3 (LE): archive personal client/session-notes
// workspace only. §4 (GYU): remove Slack access + remove Google Calendar
// access only — neither slice ever touches curriculum/meditation-library
// removal.
const LE_OFFER_ID = 1;
const GYU_OFFER_ID = 2;

const leTemplates = (): OffboardingRequirementTemplate[] => [
  {
    id: 1,
    offer_id: LE_OFFER_ID,
    key: "notes_archived",
    label: "Session notes archived",
    task_text_template: "Move {name}'s session notes to Past Clients",
    is_required: true,
    sort_order: 1,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

const gyuTemplates = (): OffboardingRequirementTemplate[] => [
  {
    id: 2,
    offer_id: GYU_OFFER_ID,
    key: "slack_removed",
    label: "Slack access removed",
    task_text_template: "Remove {name} from GYU Slack",
    is_required: true,
    sort_order: 1,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: 3,
    offer_id: GYU_OFFER_ID,
    key: "calendar_removed",
    label: "Google Calendar access removed",
    task_text_template: "Remove {name} from GYU Google Calendar",
    is_required: true,
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
  stage: "won",
  outcome: null,
  amount: 4000,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildEnrollment = (overrides: Partial<Enrollment> = {}): Enrollment => ({
  id: 1,
  opportunity_id: 10,
  status: "active",
  start_date: "2026-01-01",
  end_date: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildFixtures = (
  templates: OffboardingRequirementTemplate[],
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
  const enrollment = buildEnrollment({ opportunity_id: deal.id });
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      ],
      offers: [offer],
      deals: [deal],
      enrollments: [enrollment],
      offboarding_requirement_templates: templates,
      enrollment_offboarding_items: [],
    }),
    silent: true,
    latency: 0,
  });
  return { dataProvider, deal, enrollment };
};

describe("offboarding checklist seeding (handle_enrollment_offboarding_started() FakeRest mirror)", () => {
  it("starting offboarding on an LE Enrollment seeds exactly the LE checklist, one Task for the required item, correctly linked", async () => {
    const { dataProvider, enrollment } = buildFixtures(leTemplates());

    await dataProvider.update("enrollments", {
      id: enrollment.id,
      data: { status: "offboarding" },
      previousData: enrollment,
    });

    const { data: items } =
      await dataProvider.getList<EnrollmentOffboardingItem>(
        "enrollment_offboarding_items",
        {
          filter: { enrollment_id: enrollment.id },
          pagination: { page: 1, perPage: 10 },
          sort: { field: "sort_order", order: "ASC" },
        },
      );
    expect(items.map((item) => item.requirement_key)).toEqual([
      "notes_archived",
    ]);
    expect(items.every((item) => item.status === "pending")).toBe(true);

    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { enrollment_id: enrollment.id },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe(
      "Move Ada Lovelace's session notes to Past Clients",
    );
    expect(tasks[0].onboarding_item_id ?? null).toBeNull();
    expect(tasks[0].offboarding_item_id).toBe(items[0].id);
    expect(tasks[0].type).toBe("offboarding_item");
  });

  it("starting offboarding on a GYU Enrollment seeds the Slack + Calendar checklist, one Task each — never a curriculum/meditation-library removal item", async () => {
    const { dataProvider, enrollment } = buildFixtures(gyuTemplates(), {
      offer_id: GYU_OFFER_ID,
    });

    await dataProvider.update("enrollments", {
      id: enrollment.id,
      data: { status: "offboarding" },
      previousData: enrollment,
    });

    const { data: items } =
      await dataProvider.getList<EnrollmentOffboardingItem>(
        "enrollment_offboarding_items",
        {
          filter: { enrollment_id: enrollment.id },
          pagination: { page: 1, perPage: 10 },
          sort: { field: "sort_order", order: "ASC" },
        },
      );
    expect(items.map((item) => item.requirement_key)).toEqual([
      "slack_removed",
      "calendar_removed",
    ]);
    expect(
      items.some(
        (item) =>
          item.requirement_key.includes("curriculum") ||
          item.requirement_key.includes("meditation"),
      ),
    ).toBe(false);

    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { enrollment_id: enrollment.id },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks).toHaveLength(2);
    expect(tasks.map((task) => task.text)).toEqual([
      "Remove Ada Lovelace from GYU Slack",
      "Remove Ada Lovelace from GYU Google Calendar",
    ]);
  });

  it("zero configured templates for the Offer is a valid, explicit state — seeds nothing, no Task, no error", async () => {
    const { dataProvider, enrollment } = buildFixtures([]);

    await expect(
      dataProvider.update("enrollments", {
        id: enrollment.id,
        data: { status: "offboarding" },
        previousData: enrollment,
      }),
    ).resolves.toBeTruthy();

    const { total: itemsTotal } = await dataProvider.getList(
      "enrollment_offboarding_items",
      {
        filter: { enrollment_id: enrollment.id },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(itemsTotal).toBe(0);
  });

  it("only the genuine active -> offboarding transition seeds — an unrelated field update on an already-offboarding Enrollment never re-seeds", async () => {
    const { dataProvider, enrollment } = buildFixtures(leTemplates());

    await dataProvider.update("enrollments", {
      id: enrollment.id,
      data: { status: "offboarding" },
      previousData: enrollment,
    });
    const { data: offboarding } = await dataProvider.getOne<Enrollment>(
      "enrollments",
      { id: enrollment.id },
    );
    // An unrelated field edit while already offboarding (e.g. adjusting
    // end_date) must never re-trigger the seed.
    await dataProvider.update("enrollments", {
      id: enrollment.id,
      data: { end_date: "2026-06-01" },
      previousData: offboarding,
    });

    const { total: itemsTotal } = await dataProvider.getList(
      "enrollment_offboarding_items",
      {
        filter: { enrollment_id: enrollment.id },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(itemsTotal).toBe(1);
  });
});
