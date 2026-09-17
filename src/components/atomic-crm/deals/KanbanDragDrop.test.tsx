import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { memoryStore } from "ra-core";
import { MemoryRouter } from "react-router";
import type { DropResult } from "@hello-pangea/dnd";

import { CRM } from "../root/CRM";
import { Notification } from "@/components/admin/notification";
import { testI18nProvider } from "../providers/commons/i18nProvider";
import { createDataProvider } from "../providers/fakerest/dataProvider";
import {
  buildContact,
  createCrmDb,
  createTestAuthProvider,
} from "@/test/StoryWrapper";
import {
  defaultDealPipelineStatuses,
  defaultDealStages,
} from "../root/defaultConfiguration";
import { applyDealStageDrop } from "./applyDealStageDrop";
import { getDealsByStage } from "./stages";
import type { Deal, DealStageEvent, Offer } from "../types";

// The Kanban drop, proven at the layer where it can actually be wrong.
//
// SCOPE, stated plainly: this does NOT simulate the browser drag gesture.
// @hello-pangea/dnd's own keyboard sensor reads the legacy event.keyCode,
// which Chrome will not populate from a synthetic KeyboardEvent, and every
// attempt to fake it produced a test that reported a successful move that
// had not happened — worse than no test. The gesture belongs to the
// library and is its responsibility.
//
// What IS ours, and what is proven here, is everything after the drop:
// the DropResult the library hands back becomes a durable stage change,
// stamped, recorded exactly once, visible, and surviving a reload — plus
// the fact that Won is not a place a card can be dropped at all.
const ACTIVE_STAGES = defaultDealStages.filter(
  (stage) => !defaultDealPipelineStatuses.includes(stage.value),
);

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

const buildDeal = (over: Partial<Deal> & { id: number }): Deal =>
  ({
    name: "Ada Lovelace — The Living Example",
    contact_id: 1,
    offer_id: 1,
    stage: "interested",
    outcome: null,
    archived_at: null,
    amount: 4000,
    sales_id: 0,
    index: 0,
    pricing_mode: "standard",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    stage_entered_at: "2026-01-01T00:00:00.000Z",
    offer_name_snapshot: "The Living Example",
    ...over,
  }) as Deal;

const makeProvider = (deals: Deal[]) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      ],
      offers: [offer],
      deals,
      tasks: [],
    }),
    silent: true,
  });

const boardUi = (dataProvider: ReturnType<typeof makeProvider>) => (
  <MemoryRouter initialEntries={["/deals"]}>
    <CRM
      dataProvider={dataProvider}
      authProvider={createTestAuthProvider()}
      i18nProvider={testI18nProvider}
      store={memoryStore()}
      disableTelemetry
      layout={({ children }) => (
        <>
          {children}
          <Notification />
        </>
      )}
    />
  </MemoryRouter>
);

const readDeal = async (
  dataProvider: ReturnType<typeof makeProvider>,
  id: number,
) => (await dataProvider.getOne<Deal>("deals", { id })).data;

const readStageEvents = async (
  dataProvider: ReturnType<typeof makeProvider>,
  id: number,
) =>
  (
    await dataProvider.getList<DealStageEvent>("deal_stage_events", {
      filter: { opportunity_id: id },
      pagination: { page: 1, perPage: 50 },
      sort: { field: "id", order: "ASC" },
    })
  ).data;

// The exact shape @hello-pangea/dnd hands to onDragEnd.
const drop = (
  draggableId: string,
  from: string,
  to: string,
  index = 0,
): DropResult =>
  ({
    draggableId,
    type: "DEFAULT",
    reason: "DROP",
    mode: "FLUID",
    source: { droppableId: from, index },
    destination: { droppableId: to, index: 0 },
    combine: null,
  }) as DropResult;

const dragTo = async (
  dataProvider: ReturnType<typeof makeProvider>,
  deal: Deal,
  to: string,
) => {
  const current = await readDeal(dataProvider, Number(deal.id));
  const dealsByStage = getDealsByStage([current], ACTIVE_STAGES);
  return applyDealStageDrop(dataProvider, {
    result: drop(String(current.id), current.stage, to),
    dealsByStage,
  });
};

describe("Kanban drop — Won is not a droppable place", () => {
  it("removes Won from the board's columns entirely", async () => {
    await page.viewport(1400, 900);
    const dataProvider = makeProvider([
      buildDeal({ id: 1, stage: "committed" }),
    ]);
    const screen = await render(boardUi(dataProvider));

    await expect.element(screen.getByText("Committed · 1")).toBeInTheDocument();

    // Structural, not a runtime rejection. A guard that ran at drop time
    // could be bypassed by any other caller; a column that does not exist
    // gives the gesture nowhere to land. Won stays payment authority.
    expect(defaultDealPipelineStatuses).toContain("won");
    expect(ACTIVE_STAGES.map((s) => s.value)).not.toContain("won");
    expect(screen.container.textContent).not.toContain("Won · ");
  });
});

describe("Kanban drop — what happens after the card lands", () => {
  it("persists the stage, stamps stage_entered_at, and records exactly one event", async () => {
    const dataProvider = makeProvider([
      buildDeal({ id: 1, stage: "interested" }),
    ]);
    const before = await readDeal(dataProvider, 1);
    const eventsBefore = await readStageEvents(dataProvider, 1);

    const outcome = await dragTo(dataProvider, before, "application_received");
    expect(outcome.applied).toBe(true);

    const after = await readDeal(dataProvider, 1);
    expect(after.stage).toBe("application_received");
    expect(after.stage_entered_at).not.toBe(before.stage_entered_at);

    const eventsAfter = await readStageEvents(dataProvider, 1);
    expect(eventsAfter.length - eventsBefore.length).toBe(1);
    expect(eventsAfter[eventsAfter.length - 1].stage).toBe(
      "application_received",
    );
  });

  it("records one event per move through a representative run of the pipeline", async () => {
    const dataProvider = makeProvider([
      buildDeal({ id: 1, stage: "interested" }),
    ]);
    const eventsBefore = (await readStageEvents(dataProvider, 1)).length;

    const path = [
      "application_received",
      "approved",
      "call_booked",
      "decision",
      "committed",
    ];
    for (const to of path) {
      const deal = await readDeal(dataProvider, 1);
      const outcome = await dragTo(dataProvider, deal, to);
      expect(outcome.applied).toBe(true);
      expect((await readDeal(dataProvider, 1)).stage).toBe(to);
    }

    const eventsAfter = await readStageEvents(dataProvider, 1);
    const newStages = eventsAfter.slice(eventsBefore).map((e) => e.stage);
    expect(newStages).toEqual(path);
    // One row per move — not one per render, and none duplicated.
    expect(new Set(newStages).size).toBe(path.length);
  });

  it("a repeated drop onto the column it already occupies writes nothing", async () => {
    const dataProvider = makeProvider([
      buildDeal({ id: 1, stage: "approved" }),
    ]);
    const before = await readDeal(dataProvider, 1);
    const eventsBefore = (await readStageEvents(dataProvider, 1)).length;

    const outcome = await dragTo(dataProvider, before, "approved");

    expect(outcome).toEqual({ applied: false, reason: "same-column" });
    const after = await readDeal(dataProvider, 1);
    expect(after.stage_entered_at).toBe(before.stage_entered_at);
    expect((await readStageEvents(dataProvider, 1)).length).toBe(eventsBefore);
  });

  it("a card dropped outside any column writes nothing", async () => {
    const dataProvider = makeProvider([
      buildDeal({ id: 1, stage: "approved" }),
    ]);
    const eventsBefore = (await readStageEvents(dataProvider, 1)).length;

    const outcome = await applyDealStageDrop(dataProvider, {
      result: {
        draggableId: "1",
        type: "DEFAULT",
        reason: "DROP",
        mode: "FLUID",
        source: { droppableId: "approved", index: 0 },
        destination: null,
        combine: null,
      } as DropResult,
      dealsByStage: getDealsByStage(
        [await readDeal(dataProvider, 1)],
        ACTIVE_STAGES,
      ),
    });

    expect(outcome).toEqual({ applied: false, reason: "no-destination" });
    expect((await readDeal(dataProvider, 1)).stage).toBe("approved");
    expect((await readStageEvents(dataProvider, 1)).length).toBe(eventsBefore);
  });

  it("shows the move on the board and keeps it across a reload", async () => {
    await page.viewport(1400, 900);
    const dataProvider = makeProvider([
      buildDeal({ id: 1, stage: "approved" }),
    ]);
    const screen = await render(boardUi(dataProvider));
    await expect.element(screen.getByText("Approved · 1")).toBeInTheDocument();

    await dragTo(dataProvider, await readDeal(dataProvider, 1), "call_booked");
    screen.unmount();

    // A fresh mount against the same data is what a hard reload gives the
    // user: the move has to come back from the data, not from a
    // component's local state.
    const reloaded = await render(boardUi(dataProvider));
    await expect
      .element(reloaded.getByText("Call Booked · 1"))
      .toBeInTheDocument();
    await expect
      .element(reloaded.getByText("Approved · 0"))
      .toBeInTheDocument();
    await expect
      .element(reloaded.getByText("Ada Lovelace"))
      .toBeInTheDocument();
  });
});
