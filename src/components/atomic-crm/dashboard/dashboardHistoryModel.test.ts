import { describe, expect, it } from "vitest";

import { buildAnalyticsContext } from "@/lib/analytics/buildAnalyticsContext";

import { buildDashboardHistoryModel } from "./dashboardHistoryModel";

describe("buildDashboardHistoryModel", () => {
  it("treats the current year as YTD and computes YoY on the last two closed years", () => {
    const model = buildDashboardHistoryModel({
      meta: {
        id: 1,
        business_timezone: "Europe/Rome",
        as_of_date: "2026-02-28",
        current_year: 2026,
        latest_closed_year: 2025,
        first_year_with_data: 2024,
        last_year_with_data: 2026,
        total_years: 3,
        has_current_year_data: true,
        has_future_services: true,
      },
      yearlyRevenueRows: [
        {
          year: 2024,
          is_closed_year: true,
          is_ytd: false,
          as_of_date: "2026-02-28",
          revenue: 10000,
          total_km: 0,
          km_cost: 0,
          services_count: 10,
          projects_count: 3,
          clients_count: 2,
        },
        {
          year: 2025,
          is_closed_year: true,
          is_ytd: false,
          as_of_date: "2026-02-28",
          revenue: 15000,
          total_km: 0,
          km_cost: 0,
          services_count: 12,
          projects_count: 4,
          clients_count: 3,
        },
        {
          year: 2026,
          is_closed_year: false,
          is_ytd: true,
          as_of_date: "2026-02-28",
          revenue: 2000,
          total_km: 0,
          km_cost: 0,
          services_count: 2,
          projects_count: 1,
          clients_count: 1,
        },
      ],
      categoryRows: [
        {
          year: 2024,
          category: "wedding",
          is_closed_year: true,
          is_ytd: false,
          as_of_date: "2026-02-28",
          revenue: 10000,
          services_count: 10,
          projects_count: 3,
        },
        {
          year: 2025,
          category: "produzione_tv",
          is_closed_year: true,
          is_ytd: false,
          as_of_date: "2026-02-28",
          revenue: 15000,
          services_count: 12,
          projects_count: 4,
        },
        {
          year: 2026,
          category: "spot",
          is_closed_year: false,
          is_ytd: true,
          as_of_date: "2026-02-28",
          revenue: 2000,
          services_count: 2,
          projects_count: 1,
        },
      ],
      clientRows: [
        {
          client_id: 10,
          client_name: "Cliente A",
          first_service_date: "2024-01-15",
          last_service_date: "2026-02-10",
          lifetime_revenue: 27000,
          active_years_count: 3,
          projects_count: 4,
          services_count: 24,
        },
      ],
    });

    expect(model.kpis.totalHistoricalRevenue).toBe(27000);
    expect(model.kpis.yoyClosedYears.isComparable).toBe(true);
    expect(model.kpis.yoyClosedYears.valuePct).toBe(50);
    expect(model.kpis.yoyClosedYears.comparisonLabel).toBe("2025 vs 2024");
    expect(model.yearlyRevenue.at(-1)?.label).toBe("2026 finora");
    expect(model.qualityFlags).toContain("partial_current_year");
    expect(model.qualityFlags).toContain("future_services_excluded");
  });

  it("returns N/D YoY when the previous closed year is zero", () => {
    const model = buildDashboardHistoryModel({
      meta: {
        id: 1,
        business_timezone: "Europe/Rome",
        as_of_date: "2026-02-28",
        current_year: 2026,
        latest_closed_year: 2025,
        first_year_with_data: 2024,
        last_year_with_data: 2026,
        total_years: 3,
        has_current_year_data: true,
        has_future_services: false,
      },
      yearlyRevenueRows: [
        {
          year: 2024,
          is_closed_year: true,
          is_ytd: false,
          as_of_date: "2026-02-28",
          revenue: 0,
          total_km: 0,
          km_cost: 0,
          services_count: 0,
          projects_count: 0,
          clients_count: 0,
        },
        {
          year: 2025,
          is_closed_year: true,
          is_ytd: false,
          as_of_date: "2026-02-28",
          revenue: 5000,
          total_km: 0,
          km_cost: 0,
          services_count: 3,
          projects_count: 1,
          clients_count: 1,
        },
        {
          year: 2026,
          is_closed_year: false,
          is_ytd: true,
          as_of_date: "2026-02-28",
          revenue: 1000,
          total_km: 0,
          km_cost: 0,
          services_count: 1,
          projects_count: 1,
          clients_count: 1,
        },
      ],
      categoryRows: [],
      clientRows: [],
    });

    expect(model.kpis.yoyClosedYears.isComparable).toBe(false);
    expect(model.kpis.yoyClosedYears.reason).toBe("zero_baseline");
    expect(model.kpis.yoyClosedYears.formattedValue).toBe("N/D");
    expect(model.qualityFlags).toContain("zero_baseline");
  });
});

describe("buildAnalyticsContext", () => {
  it("serializes semantic information for future AI interpretation", () => {
    const model = buildDashboardHistoryModel({
      meta: {
        id: 1,
        business_timezone: "Europe/Rome",
        as_of_date: "2026-02-28",
        current_year: 2026,
        latest_closed_year: 2025,
        first_year_with_data: 2025,
        last_year_with_data: 2026,
        total_years: 2,
        has_current_year_data: true,
        has_future_services: false,
      },
      yearlyRevenueRows: [
        {
          year: 2025,
          is_closed_year: true,
          is_ytd: false,
          as_of_date: "2026-02-28",
          revenue: 9000,
          total_km: 0,
          km_cost: 0,
          services_count: 4,
          projects_count: 2,
          clients_count: 2,
        },
        {
          year: 2026,
          is_closed_year: false,
          is_ytd: true,
          as_of_date: "2026-02-28",
          revenue: 1000,
          total_km: 0,
          km_cost: 0,
          services_count: 1,
          projects_count: 1,
          clients_count: 1,
        },
      ],
      categoryRows: [],
      clientRows: [],
    });

    const context = buildAnalyticsContext(model);

    expect(context.meta.asOfDate).toBe("2026-02-28");
    expect(
      context.metrics.find((metric) => metric.id === "yoy_closed_years")
        ?.isComparable,
    ).toBe(false);
    expect(context.series.yearlyRevenue.at(-1)?.isYtd).toBe(true);
    expect(context.qualityFlags).toContain("partial_current_year");
    expect(context.caveats).toContain(
      "Tutti i valori storici sono compensi per competenza (data lavoro), non incassi. La simulazione fiscale annuale usa invece il principio di cassa (data incasso).",
    );
    expect(context.caveats).toContain(
      "2026 è trattato come YTD al 28/02/2026.",
    );
    expect(context.caveats).toContain(
      "Il YoY non è dimostrabile con i dati disponibili: servono almeno due anni chiusi.",
    );
  });
});
