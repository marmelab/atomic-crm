import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type {
  Deal,
  Enrollment,
  EnrollmentOffboardingItem,
  EnrollmentStatus,
  Offer,
  OffboardingRequirementTemplate,
  Task,
} from "../types";
import { startOffboarding } from "./startOffboarding";

const ENROLLMENT_ID = 1;
const DEAL_ID = 1;
const OFFER_ID = 1;

const buildOffer = (): Offer => ({
  id: OFFER_ID,
  name: "The Living Example",
  type: "individual",
  duration: "ongoing",
  current_price: 4000,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
});

const buildDeal = (): Deal => ({
  pricing_mode: "standard",
  id: DEAL_ID,
  name: "Ada Lovelace",
  contact_id: 1,
  offer_id: OFFER_ID,
  stage: "won",
  outcome: null,
  amount: 4000,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-01-01T00:00:00.000Z",
});

const buildEnrollment = (overrides: Partial<Enrollment> = {}): Enrollment => ({
  id: ENROLLMENT_ID,
  opportunity_id: DEAL_ID,
  status: "active",
  start_date: "2026-01-01",
  end_date: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const templates = (): OffboardingRequirementTemplate[] => [
  {
    id: 1,
    offer_id: OFFER_ID,
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

const buildFixtures = (
  enrollment: Enrollment,
  overrides: { offboardingTemplates?: OffboardingRequirementTemplate[] } = {},
) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      ],
      offers: [buildOffer()],
      deals: [buildDeal()],
      enrollments: [enrollment],
      offboarding_requirement_templates:
        overrides.offboardingTemplates ?? templates(),
      enrollment_offboarding_items: [],
    }),
    silent: true,
    latency: 0,
  });
  return { dataProvider };
};

describe("startOffboarding", () => {
  it("transitions an active Enrollment to offboarding and snapshots the checklist", async () => {
    const { dataProvider } = buildFixtures(buildEnrollment());

    const result = await startOffboarding(dataProvider, ENROLLMENT_ID);
    expect(result).toEqual({ applied: true });

    const { data: enrollment } = await dataProvider.getOne<Enrollment>(
      "enrollments",
      { id: ENROLLMENT_ID },
    );
    expect(enrollment.status).toBe("offboarding");

    const { data: items } =
      await dataProvider.getList<EnrollmentOffboardingItem>(
        "enrollment_offboarding_items",
        {
          filter: { enrollment_id: ENROLLMENT_ID },
          pagination: { page: 1, perPage: 10 },
          sort: { field: "sort_order", order: "ASC" },
        },
      );
    expect(items.map((item) => item.requirement_key)).toEqual([
      "notes_archived",
    ]);
    expect(items.every((item) => item.status === "pending")).toBe(true);

    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { enrollment_id: ENROLLMENT_ID },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe(
      "Move Ada Lovelace's session notes to Past Clients",
    );
    expect(tasks[0].offboarding_item_id).toBe(items[0].id);
    expect(tasks[0].type).toBe("offboarding_item");
  });

  it.each<EnrollmentStatus>(["onboarding", "offboarding", "completed"])(
    "rejects starting offboarding from %s — only an active Enrollment can start",
    async (status) => {
      const { dataProvider } = buildFixtures(buildEnrollment({ status }));

      const result = await startOffboarding(dataProvider, ENROLLMENT_ID);
      expect(result).toEqual({ applied: false, reason: "not-active" });

      const { data: enrollment } = await dataProvider.getOne<Enrollment>(
        "enrollments",
        { id: ENROLLMENT_ID },
      );
      expect(enrollment.status).toBe(status);
    },
  );

  it("is idempotent — a double-click (calling it again while already offboarding) never re-seeds the checklist or Tasks", async () => {
    const { dataProvider } = buildFixtures(buildEnrollment());

    const first = await startOffboarding(dataProvider, ENROLLMENT_ID);
    expect(first).toEqual({ applied: true });
    const second = await startOffboarding(dataProvider, ENROLLMENT_ID);
    expect(second).toEqual({ applied: false, reason: "not-active" });

    const { total: itemsTotal } = await dataProvider.getList(
      "enrollment_offboarding_items",
      {
        filter: { enrollment_id: ENROLLMENT_ID },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(itemsTotal).toBe(1);
    const { total: tasksTotal } = await dataProvider.getList("tasks", {
      filter: { enrollment_id: ENROLLMENT_ID },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasksTotal).toBe(1);
  });

  // Documents actual parity with handle_enrollment_offboarding_started():
  // the real Postgres trigger has no ON CONFLICT DO NOTHING guard against
  // re-seeding (unlike the Won-transition path, where the Enrollment
  // itself can only ever be created once) — a genuine bounce back to
  // active and forward into offboarding again legitimately re-seeds a
  // second checklist. This is a real behavior, not a bug: each "Start
  // offboarding" from active is treated as a fresh human decision.
  it("a genuine re-entry into offboarding (bounced back to active first) legitimately re-seeds a second checklist, matching the real trigger", async () => {
    const { dataProvider } = buildFixtures(buildEnrollment());

    await startOffboarding(dataProvider, ENROLLMENT_ID);
    const { data: offboarding } = await dataProvider.getOne<Enrollment>(
      "enrollments",
      { id: ENROLLMENT_ID },
    );
    await dataProvider.update("enrollments", {
      id: ENROLLMENT_ID,
      data: { status: "active" },
      previousData: offboarding,
    });
    await startOffboarding(dataProvider, ENROLLMENT_ID);

    const { total: itemsTotal } = await dataProvider.getList(
      "enrollment_offboarding_items",
      {
        filter: { enrollment_id: ENROLLMENT_ID },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(itemsTotal).toBe(2);
  });

  it("the DB-level lifecycle-sequence guard (FakeRest mirror) rejects a direct onboarding -> offboarding skip", async () => {
    const { dataProvider } = buildFixtures(
      buildEnrollment({ status: "onboarding" }),
    );

    await expect(
      dataProvider.update("enrollments", {
        id: ENROLLMENT_ID,
        data: { status: "offboarding" },
        previousData: buildEnrollment({ status: "onboarding" }),
      }),
    ).rejects.toThrow();
  });
});
