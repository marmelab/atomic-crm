import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Contact, Deal, DealNote, Offer, Task } from "../types";
import { removeFromPipeline } from "./removeFromPipeline";
import { PIPELINE_EXIT_REASONS, type PipelineExitReason } from "./pipelineExit";
import { isActiveOpportunity } from "./dealActivity";

// Every way out of the pipeline, proved once each.
//
// Ending a sales attempt signed Leif out — twice, on real prospects —
// because the outcome write tripped a missing grant and the CRM read the
// database's 403 as an expired login. The grant is fixed in the database
// and the auth rule is narrowed, but the reason this file exists is that
// nobody had ever exercised the ten exit routes end to end. A defect on
// the central exit path is a defect on all ten.

const CONTACT_ID = 3;
const DEAL_ID = 31;

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
    name: "Zz Exit — The Living Example",
    contact_id: CONTACT_ID,
    offer_id: 1,
    stage: "decision",
    outcome: null,
    archived_at: null,
    owner_decision: null,
    prospect_decision: null,
    exit_reason: null,
    exit_note: null,
    amount: 4000,
    sales_id: 0,
    index: 0,
    pricing_mode: "standard",
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    stage_entered_at: "2026-05-01T00:00:00.000Z",
    ...over,
  }) as Deal;

const buildProvider = () =>
  createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: CONTACT_ID, first_name: "Zz", last_name: "Exit" }),
      ],
      offers: [offer],
      deals: [buildDeal()],
      tasks: [
        {
          id: 900,
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

// "Other" is the only reason that requires a note, so every route is
// given one — it is optional everywhere else and changes nothing.
const NOTE = "zz synthetic exit";

describe.each(PIPELINE_EXIT_REASONS.map((r) => r.reason))(
  "exit route: %s",
  (reason: PipelineExitReason) => {
    const definition = PIPELINE_EXIT_REASONS.find((r) => r.reason === reason)!;

    it("records the reason and leaves the active pipeline", async () => {
      // Arrange
      const dataProvider = buildProvider();

      // Act
      const result = await removeFromPipeline(dataProvider, {
        opportunityId: DEAL_ID,
        reason,
        note: NOTE,
      });

      // Assert
      expect(result).toEqual({ status: "removed", reason });

      const { data: deal } = await dataProvider.getOne<Deal>("deals", {
        id: DEAL_ID,
      });
      expect(deal.outcome).toBe(definition.outcome);
      expect(deal.exit_reason).toBe(reason);
      expect(deal.exit_note).toBe(NOTE);
      // Every route sets an outcome, and an outcome is what "no longer
      // active" means — so all ten leave the board, whatever they mean.
      expect(deal.outcome).not.toBeNull();
      expect(isActiveOpportunity(deal)).toBe(false);
    });

    it("keeps the person, the Opportunity and the history", async () => {
      const dataProvider = buildProvider();
      await removeFromPipeline(dataProvider, {
        opportunityId: DEAL_ID,
        reason,
        note: NOTE,
      });

      const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
        id: CONTACT_ID,
      });
      expect(contact.id).toBe(CONTACT_ID);

      const { data: deal } = await dataProvider.getOne<Deal>("deals", {
        id: DEAL_ID,
      });
      // Nothing deleted, nothing archived, and the stage still records
      // how far the sale actually got.
      expect(deal.archived_at ?? null).toBeNull();
      expect(deal.stage).toBe("decision");

      const { data: notes } = await dataProvider.getList<DealNote>(
        "deal_notes",
        {
          filter: { deal_id: DEAL_ID },
          pagination: { page: 1, perPage: 10 },
          sort: { field: "id", order: "ASC" },
        },
      );
      expect(notes).toHaveLength(1);
      expect(notes[0].text).toContain(definition.label);
    });

    it("closes the sales work it answers", async () => {
      const dataProvider = buildProvider();
      await removeFromPipeline(dataProvider, {
        opportunityId: DEAL_ID,
        reason,
        note: NOTE,
      });

      const { data: tasks } = await dataProvider.getList<Task>("tasks", {
        filter: { contact_id: CONTACT_ID },
        pagination: { page: 1, perPage: 50 },
        sort: { field: "id", order: "ASC" },
      });
      expect(tasks.filter((t) => t.status === "pending")).toHaveLength(0);
    });

    it("is a safe no-op the second time", async () => {
      const dataProvider = buildProvider();
      await removeFromPipeline(dataProvider, {
        opportunityId: DEAL_ID,
        reason,
        note: NOTE,
      });

      const second = await removeFromPipeline(dataProvider, {
        opportunityId: DEAL_ID,
        reason,
        note: NOTE,
      });

      expect(second.status).toBe("already-resolved");
      const { data: notes } = await dataProvider.getList<DealNote>(
        "deal_notes",
        {
          filter: { deal_id: DEAL_ID },
          pagination: { page: 1, perPage: 10 },
          sort: { field: "id", order: "ASC" },
        },
      );
      // One exit, one entry in the history — never a duplicate.
      expect(notes).toHaveLength(1);
    });
  },
);

describe("the routes that carry more than an outcome", () => {
  it("only Ghosted tags the Contact", async () => {
    const tagged = new Set<PipelineExitReason>();

    for (const definition of PIPELINE_EXIT_REASONS) {
      const dataProvider = buildProvider();
      await removeFromPipeline(dataProvider, {
        opportunityId: DEAL_ID,
        reason: definition.reason,
        note: NOTE,
      });
      const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
        id: CONTACT_ID,
      });
      if ((contact.tags ?? []).length > 0) tagged.add(definition.reason);
    }

    expect([...tagged]).toEqual(["ghosted"]);
  });

  it("only Do not engage changes who Leif may sell to", async () => {
    const gated = new Set<PipelineExitReason>();

    for (const definition of PIPELINE_EXIT_REASONS) {
      const dataProvider = buildProvider();
      await removeFromPipeline(dataProvider, {
        opportunityId: DEAL_ID,
        reason: definition.reason,
        note: NOTE,
      });
      const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
        id: CONTACT_ID,
      });
      if (contact.sales_eligibility === "do_not_engage") {
        gated.add(definition.reason);
      }
    }

    expect([...gated]).toEqual(["do_not_engage"]);
  });

  it("Other refuses without a note, and says so rather than failing", async () => {
    const dataProvider = buildProvider();

    const result = await removeFromPipeline(dataProvider, {
      opportunityId: DEAL_ID,
      reason: "other",
      note: "   ",
    });

    expect(result.status).toBe("note-required");
    const { data: deal } = await dataProvider.getOne<Deal>("deals", {
      id: DEAL_ID,
    });
    // Refused before anything was written.
    expect(deal.outcome ?? null).toBeNull();
    expect(isActiveOpportunity(deal)).toBe(true);
  });

  it("never creates an Enrollment or writes payment truth", async () => {
    for (const definition of PIPELINE_EXIT_REASONS) {
      const dataProvider = buildProvider();
      await removeFromPipeline(dataProvider, {
        opportunityId: DEAL_ID,
        reason: definition.reason,
        note: NOTE,
      });

      const { total } = await dataProvider.getList("enrollments", {
        filter: {},
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      });
      expect(total ?? 0).toBe(0);

      const { data: deal } = await dataProvider.getOne<Deal>("deals", {
        id: DEAL_ID,
      });
      expect(deal.selected_payment_total ?? null).toBeNull();
      expect(deal.payment_setup_confirmed_at ?? null).toBeNull();
    }
  });
});
