import { describe, expect, it } from "vitest";

import {
  buildQuickEpisodeExpenseCreateData,
  buildQuickEpisodeServiceCreateData,
} from "./quickEpisodePersistence";

describe("quickEpisodePersistence", () => {
  const record = {
    id: "project-tv-1",
    client_id: "client-1",
  };

  const data = {
    service_date: "2026-02-22",
    service_type: "riprese_montaggio" as const,
    fee_shooting: 233,
    fee_editing: 156,
    fee_other: 0,
    km_distance: 144.24,
    km_rate: 0.19,
    location: "Acireale",
    notes: "Intervista a Roberto Lipari",
    extra_expenses: [
      {
        expense_type: "altro" as const,
        amount: 12.5,
        markup_percent: 0,
        description: "Casello autostradale",
      },
      {
        expense_type: "altro" as const,
        amount: 18,
        markup_percent: 10,
        description: "Pranzo troupe",
      },
      {
        expense_type: "noleggio" as const,
        amount: 0,
        markup_percent: 0,
        description: "",
      },
    ],
  };

  it("builds the service payload for the quick-episode save", () => {
    expect(
      buildQuickEpisodeServiceCreateData({
        record,
        data,
      }),
    ).toEqual({
      project_id: "project-tv-1",
      service_date: "2026-02-22",
      all_day: true,
      is_taxable: true,
      service_type: "riprese_montaggio",
      fee_shooting: 233,
      fee_editing: 156,
      fee_other: 0,
      discount: 0,
      km_distance: 144.24,
      km_rate: 0.19,
      location: "Acireale",
      notes: "Intervista a Roberto Lipari",
    });
  });

  it("builds only extra (non-km) expense payloads — km expenses are auto-created by DB trigger", () => {
    expect(
      buildQuickEpisodeExpenseCreateData({
        record,
        data,
      }),
    ).toEqual([
      {
        project_id: "project-tv-1",
        client_id: "client-1",
        expense_date: "2026-02-22",
        expense_type: "altro",
        amount: 12.5,
        markup_percent: 0,
        description: "Casello autostradale",
      },
      {
        project_id: "project-tv-1",
        client_id: "client-1",
        expense_date: "2026-02-22",
        expense_type: "altro",
        amount: 18,
        markup_percent: 10,
        description: "Pranzo troupe",
      },
    ]);
  });
});
