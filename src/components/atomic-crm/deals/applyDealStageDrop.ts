import type { DataProvider } from "ra-core";
import type { DropResult } from "@hello-pangea/dnd";

import type { Deal } from "../types";
import type { DealsByStage } from "./stages";

// What a Kanban drop actually does, lifted out of the component so it can
// be proven.
//
// It used to live inline in DealListContent's onDragEnd, where nothing
// could reach it: the only way to exercise the single most-used gesture on
// the board was to simulate a browser drag, and the parts that can be
// silently wrong are not the gesture — they are whether the move became
// durable, whether it recorded its history exactly once, and whether a
// second drop of the same card can double-write.
//
// Takes the library's own DropResult, so the contract under test is the
// real one rather than a convenient re-shaping of it.
export type DealStageDropOutcome =
  | { applied: true; deal: Deal; from: string; to: string }
  // Dropped outside any column, or back into the column it came from.
  // Columns sort by stage_entered_at rather than a manual position, so a
  // same-column drop has nothing to persist.
  | {
      applied: false;
      reason: "no-destination" | "same-column" | "unknown-card";
    };

export const applyDealStageDrop = async (
  dataProvider: DataProvider,
  { result, dealsByStage }: { result: DropResult; dealsByStage: DealsByStage },
): Promise<DealStageDropOutcome> => {
  const { destination, source } = result;
  if (!destination) return { applied: false, reason: "no-destination" };

  const from = source.droppableId;
  const to = destination.droppableId;
  if (from === to) return { applied: false, reason: "same-column" };

  const deal = dealsByStage[from]?.[source.index];
  if (!deal) return { applied: false, reason: "unknown-card" };

  // The one shared path every other stage-changing pathway already uses
  // (Application review, sales-call booking and outcomes): the "deals"
  // resource hook stamps stage_entered_at and appends the
  // deal_stage_events history row, so there is deliberately nothing else
  // to write here. A drop must not become a second, parallel way to change
  // a stage — that is how two mechanisms drift apart.
  await dataProvider.update("deals", {
    id: deal.id,
    data: { stage: to },
    previousData: deal,
  });

  return { applied: true, deal, from, to };
};
