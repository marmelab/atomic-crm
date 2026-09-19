import { render } from "vitest-browser-react";

import { StoryWrapper, buildContact, createCrmDb } from "@/test/StoryWrapper";
import { createDataProvider } from "../providers/fakerest/dataProvider";
import { OpportunityDecisionActions } from "./OpportunityDecisionActions";
import { removeFromPipeline } from "./removeFromPipeline";
import { GHOSTED_TAG_NAME } from "./recordOpportunityDecision";
import type { Contact, Deal, Offer, Tag, Task } from "../types";

// Ghosted is a third answer, not a flavour of No.
//
// The Decision card offered Yes and No, and Ghosted sat inside No's reason
// list — which made silence a kind of declining. It is not: one is a
// person telling you no, the other is a person telling you nothing, and
// only the second decides whether Leif ever writes to them again.
//
// Nothing infers it. Not elapsed time, not a missed follow-up, not a
// cancellation, not a no-show. It happens when somebody clicks it.

const CONTACT_ID = 4;
const DEAL_ID = 21;

const offer: Offer = {
  id: 1,
  name: "The Living Example",
  type: "individual",
  duration: "6 months",
  current_price: 4000,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildDeal = (over: Partial<Deal> = {}): Deal =>
  ({
    id: DEAL_ID,
    name: "Zz Quiet — The Living Example",
    contact_id: CONTACT_ID,
    offer_id: 1,
    stage: "decision",
    outcome: null,
    archived_at: null,
    owner_decision: null,
    prospect_decision: null,
    exit_reason: null,
    amount: 4000,
    sales_id: 0,
    index: 0,
    pricing_mode: "standard",
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    stage_entered_at: "2026-05-01T00:00:00.000Z",
    ...over,
  }) as Deal;

const contact = () =>
  buildContact({ id: CONTACT_ID, first_name: "Zz", last_name: "Quiet" });

const show = (deal = buildDeal()) =>
  render(
    <StoryWrapper
      data={{ deals: [deal], contacts: [contact()], offers: [offer] }}
    >
      <OpportunityDecisionActions deal={deal} />
    </StoryWrapper>,
  );

const buildProvider = (over: Partial<Deal> = {}) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [contact()],
      offers: [offer],
      deals: [buildDeal(over)],
      tasks: [],
    }),
    silent: true,
    latency: 0,
  });

describe("the Decision card offers three answers", () => {
  it("shows Yes, No and Ghosted", async () => {
    const screen = await show();

    await expect
      .element(screen.getByRole("button", { name: "Yes" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "No" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Ghosted" }))
      .toBeVisible();
  });

  it("does nothing until Ghosted is actually clicked", async () => {
    const screen = await show();

    // Arrange — the dialog is not open, so nothing can be submitted by
    // simply looking at a card that has gone quiet.
    await expect
      .element(screen.getByRole("button", { name: "Record as Ghosted" }))
      .not.toBeInTheDocument();

    // Act
    await screen.getByRole("button", { name: "Ghosted" }).click();

    // Assert — it asks first, and says what it will and will not do.
    await expect
      .element(screen.getByText("They stopped replying"))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Record as Ghosted" }))
      .toBeVisible();
  });

  it("keeps Ghosted out of the reasons offered for No", async () => {
    const screen = await show();

    await screen.getByRole("button", { name: "No" }).click();

    await expect
      .element(screen.getByRole("heading", { name: "They said no" }))
      .toBeVisible();
    // Declining is there; going quiet is not, because nobody said it.
    await expect.element(screen.getByText("Declined the offer")).toBeVisible();
    await expect
      .element(screen.getByText("They stopped replying — adds a Ghosted tag"))
      .not.toBeInTheDocument();
  });

  it("is hidden once the Opportunity has already been resolved", async () => {
    const screen = await show(buildDeal({ outcome: "lost" }));

    await expect
      .element(screen.getByRole("button", { name: "Ghosted" }))
      .not.toBeInTheDocument();
  });
});

describe("recording Ghosted", () => {
  it("leaves the active pipeline with its own distinct reason", async () => {
    // Arrange
    const dataProvider = buildProvider();

    // Act
    const result = await removeFromPipeline(dataProvider, {
      opportunityId: DEAL_ID,
      reason: "ghosted",
      note: null,
    });

    // Assert
    expect(result.status).toBe("removed");
    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.outcome).toBe("lost");
    expect(deal.exit_reason).toBe("ghosted");
    expect(deal.prospect_decision).toBe("ghosted");
    // The stage still records how far the sale reached.
    expect(deal.stage).toBe("decision");
    // Nothing deleted, nothing archived.
    expect(deal.archived_at ?? null).toBeNull();
  });

  it("is stored differently from No, which is the entire point", async () => {
    const ghosted = buildProvider();
    await removeFromPipeline(ghosted, {
      opportunityId: DEAL_ID,
      reason: "ghosted",
      note: null,
    });
    const declined = buildProvider();
    await removeFromPipeline(declined, {
      opportunityId: DEAL_ID,
      reason: "declined_offer",
      note: null,
    });

    const { data: a } = await ghosted.getOne<Deal>("deals", { id: DEAL_ID });
    const { data: b } = await declined.getOne<Deal>("deals", { id: DEAL_ID });

    expect(a.prospect_decision).toBe("ghosted");
    expect(b.prospect_decision).toBe("no");
    expect(a.exit_reason).not.toBe(b.exit_reason);
    // Both are commercially lost; only one is a behaviour worth carrying
    // to the next Opportunity.
    expect(a.outcome).toBe("lost");
    expect(b.outcome).toBe("lost");
  });

  it("tags the Contact, so the next time they appear it shows", async () => {
    const dataProvider = buildProvider();
    await removeFromPipeline(dataProvider, {
      opportunityId: DEAL_ID,
      reason: "ghosted",
      note: null,
    });

    const { data: tags } = await dataProvider.getList<Tag>("tags", {
      filter: {},
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "ASC" },
    });
    const ghostedTag = tags.find((t) => t.name === GHOSTED_TAG_NAME);
    expect(ghostedTag).toBeTruthy();

    const { data: person } = await dataProvider.getOne<Contact>("contacts", {
      id: CONTACT_ID,
    });
    expect((person.tags ?? []).map(String)).toContain(String(ghostedTag!.id));
  });

  it("closes the follow-up work it answers, and creates none", async () => {
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [contact()],
        offers: [offer],
        deals: [buildDeal()],
        tasks: [
          {
            id: 700,
            contact_id: CONTACT_ID,
            opportunity_id: DEAL_ID,
            type: "follow_up",
            text: "Follow up",
            due_date: "2026-09-22T18:00:00.000Z",
            status: "pending",
            done_date: null,
            sales_id: 0,
          } as unknown as Task,
        ],
      }),
      silent: true,
      latency: 0,
    });

    await removeFromPipeline(dataProvider, {
      opportunityId: DEAL_ID,
      reason: "ghosted",
      note: null,
    });

    const { data: tasks } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks.filter((t) => t.status === "pending")).toHaveLength(0);
  });

  it("never creates an Enrollment or touches payment", async () => {
    const dataProvider = buildProvider();

    await removeFromPipeline(dataProvider, {
      opportunityId: DEAL_ID,
      reason: "ghosted",
      note: null,
    });

    const { total: enrollments } = await dataProvider.getList("enrollments", {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(enrollments ?? 0).toBe(0);

    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    expect(deal.selected_payment_total ?? null).toBeNull();
    expect(deal.payment_setup_confirmed_at ?? null).toBeNull();
  });
});
