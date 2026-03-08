// @vitest-environment jsdom

import "@/setupTests";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardHistoricalCategoryMixChart } from "./DashboardHistoricalCategoryMixChart";
import { DashboardHistoricalKpis } from "./DashboardHistoricalKpis";
import { DashboardHistoricalRevenueChart } from "./DashboardHistoricalRevenueChart";
import { DashboardHistoricalTopClientsCard } from "./DashboardHistoricalTopClientsCard";
import {
  buildDashboardHistoryModel,
  type AnalyticsClientLifetimeCompetenceRevenueRow,
  type AnalyticsHistoryMetaRow,
  type AnalyticsYearlyCompetenceRevenueByCategoryRow,
  type AnalyticsYearlyCompetenceRevenueRow,
} from "./dashboardHistoryModel";

const baseMeta = (
  overrides: Partial<AnalyticsHistoryMetaRow> = {},
): AnalyticsHistoryMetaRow => ({
  id: 1,
  business_timezone: "Europe/Rome",
  as_of_date: "2026-02-28",
  current_year: 2026,
  latest_closed_year: 2025,
  first_year_with_data: 2024,
  last_year_with_data: 2025,
  total_years: 3,
  has_current_year_data: false,
  has_future_services: false,
  ...overrides,
});

const yearlyRow = (
  year: number,
  revenue: number,
  options: Partial<AnalyticsYearlyCompetenceRevenueRow> = {},
): AnalyticsYearlyCompetenceRevenueRow => ({
  year,
  is_closed_year: year < 2026,
  is_ytd: year === 2026,
  as_of_date: "2026-02-28",
  revenue,
  total_km: 0,
  km_cost: 0,
  services_count: 0,
  projects_count: 0,
  clients_count: 0,
  ...options,
});

const categoryRow = (
  year: number,
  category: string,
  revenue: number,
  options: Partial<AnalyticsYearlyCompetenceRevenueByCategoryRow> = {},
): AnalyticsYearlyCompetenceRevenueByCategoryRow => ({
  year,
  category,
  is_closed_year: year < 2026,
  is_ytd: year === 2026,
  as_of_date: "2026-02-28",
  revenue,
  services_count: 0,
  projects_count: 0,
  ...options,
});

const clientRow = (
  overrides: Partial<AnalyticsClientLifetimeCompetenceRevenueRow> = {},
): AnalyticsClientLifetimeCompetenceRevenueRow => ({
  client_id: "1",
  client_name: "ASSOCIAZIONE CULTURALE GUSTARE SICILIA",
  first_service_date: "2024-01-01",
  last_service_date: "2025-12-31",
  lifetime_revenue: 23700,
  active_years_count: 2,
  projects_count: 11,
  services_count: 69,
  ...overrides,
});

const buildModel = ({
  meta = baseMeta(),
  yearlyRows = [
    yearlyRow(2024, 3118),
    yearlyRow(2025, 20582),
    yearlyRow(2026, 0),
  ],
  categoryRows = [
    categoryRow(2024, "produzione_tv", 2493),
    categoryRow(2024, "spot", 625),
    categoryRow(2025, "produzione_tv", 19832),
    categoryRow(2025, "spot", 750),
  ],
  clientRows = [clientRow()],
}: {
  meta?: AnalyticsHistoryMetaRow;
  yearlyRows?: AnalyticsYearlyCompetenceRevenueRow[];
  categoryRows?: AnalyticsYearlyCompetenceRevenueByCategoryRow[];
  clientRows?: AnalyticsClientLifetimeCompetenceRevenueRow[];
} = {}) =>
  buildDashboardHistoryModel({
    meta,
    yearlyRevenueRows: yearlyRows,
    categoryRows,
    clientRows,
  });

describe("historical dashboard widgets", () => {
  it("renders YoY as N/D when two closed years are not available", () => {
    const model = buildModel({
      meta: baseMeta({
        latest_closed_year: 2025,
        first_year_with_data: 2025,
        total_years: 2,
      }),
      yearlyRows: [yearlyRow(2025, 20582), yearlyRow(2026, 0)],
      categoryRows: [categoryRow(2025, "produzione_tv", 20582)],
    });

    render(<DashboardHistoricalKpis model={model} />);

    expect(screen.getByText("Crescita")).toBeInTheDocument();
    expect(screen.getAllByText("N/D").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("2025 vs anno precedente")).toBeInTheDocument();
  });

  it("renders the category-mix error state", () => {
    const model = buildModel();

    render(
      <DashboardHistoricalCategoryMixChart
        model={model}
        isPending={false}
        hasError
      />,
    );

    expect(
      screen.getByText("Impossibile caricare il mix categorie."),
    ).toBeInTheDocument();
  });

  it("renders the category-mix empty state with the plain-language subtitle", () => {
    const model = buildModel({ categoryRows: [] });

    render(
      <DashboardHistoricalCategoryMixChart
        model={model}
        isPending={false}
        hasError={false}
      />,
    );

    expect(screen.getByText("Da dove arrivano i guadagni")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Qui vedi quali tipi di lavoro pesano di più ogni anno. Il 2026 si ferma al 28/02/2026, quindi non è un anno completo.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nessun dato storico per categoria"),
    ).toBeInTheDocument();
  });

  it("renders the top-clients empty state", () => {
    const model = buildModel({ clientRows: [] });

    render(
      <DashboardHistoricalTopClientsCard
        model={model}
        isPending={false}
        hasError={false}
      />,
    );

    expect(
      screen.getByText(
        "Nessun cliente storico disponibile fino al 28/02/2026.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the top-clients widget error state", () => {
    const model = buildModel({ clientRows: [] });

    render(
      <DashboardHistoricalTopClientsCard
        model={model}
        isPending={false}
        hasError
      />,
    );

    expect(
      screen.getByText("Impossibile caricare i clienti lifetime."),
    ).toBeInTheDocument();
  });

  it("renders the revenue-chart empty state with the historical subtitle", () => {
    const model = buildModel({
      yearlyRows: [yearlyRow(2024, 0), yearlyRow(2025, 0), yearlyRow(2026, 0)],
      categoryRows: [],
      clientRows: [],
    });

    render(<DashboardHistoricalRevenueChart model={model} />);

    expect(screen.getByText("Andamento anno per anno")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Quanto vale il lavoro anno per anno dal 2024 al 2026. Il 2026 si ferma al 28/02/2026, quindi non è un anno completo.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nessun dato storico disponibile"),
    ).toBeInTheDocument();
  });
});
