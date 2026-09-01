import type { DataProvider, Identifier } from "ra-core";

import type { SalesCall } from "../types";

// Mirrors the Postgres trigger sync_deal_sales_call_at() (supabase/schemas/
// 02_functions.sql) — keeps deals.sales_call_at (the existing "next
// scheduled call" denormalized convenience field, read unchanged by
// DealShow/DealInputs) in sync with sales_calls, the new source of truth.
// Recomputes from scratch rather than tracking "was this row the one
// currently reflected": always the scheduled_at of the Opportunity's most
// recent still-booked call, or null if none (e.g. cancelled with no
// rebooking). Called from providers/fakerest/dataProvider.ts's "sales_calls"
// resource hooks, mirroring the trigger's own AFTER INSERT/UPDATE/DELETE
// firing.
export const syncDealSalesCallAt = async (
  dataProvider: DataProvider,
  opportunityId: Identifier,
): Promise<void> => {
  const { data: bookedCalls } = await dataProvider.getList<SalesCall>(
    "sales_calls",
    {
      filter: { opportunity_id: opportunityId, status: "booked" },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "scheduled_at", order: "DESC" },
    },
  );
  const latest = bookedCalls[0]?.scheduled_at ?? null;

  const { data: deal } = await dataProvider.getOne("deals", {
    id: opportunityId,
  });
  if ((deal.sales_call_at ?? null) === latest) return;

  await dataProvider.update("deals", {
    id: opportunityId,
    data: { sales_call_at: latest },
    previousData: deal,
  });
};
