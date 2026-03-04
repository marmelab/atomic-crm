// @vitest-environment jsdom

import "@/setupTests";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { DashboardHistoryModel } from "./dashboardHistoryModel";

const renderWithQueryClient = (component: React.ReactNode) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>,
  );
};

const mockUseHistoricalDashboardData = vi.fn();

vi.mock("./useHistoricalDashboardData", () => ({
  useHistoricalDashboardData: () => mockUseHistoricalDashboardData(),
}));

vi.mock("./DashboardHistoricalKpis", () => ({
  DashboardHistoricalKpis: () => <div data-testid="historical-kpis" />,
}));

vi.mock("./DashboardHistoricalRevenueChart", () => ({
  DashboardHistoricalRevenueChart: () => (
    <div data-testid="historical-revenue-chart" />
  ),
}));

vi.mock("./DashboardHistoricalCategoryMixChart", () => ({
  DashboardHistoricalCategoryMixChart: () => (
    <div data-testid="historical-category-mix-chart" />
  ),
}));

vi.mock("./DashboardHistoricalTopClientsCard", () => ({
  DashboardHistoricalTopClientsCard: () => (
    <div data-testid="historical-top-clients-card" />
  ),
}));

vi.mock("./DashboardHistoricalCashInflowCard", () => ({
  DashboardHistoricalCashInflowCard: () => (
    <div data-testid="historical-cash-inflow-card" />
  ),
}));

vi.mock("./DashboardHistoricalAiSummaryCard", () => ({
  DashboardHistoricalAiSummaryCard: () => (
    <div data-testid="historical-ai-summary-card" />
  ),
}));

vi.mock("./DashboardHistoricalCashInflowAiCard", () => ({
  DashboardHistoricalCashInflowAiCard: () => (
    <div data-testid="historical-cash-inflow-ai-card" />
  ),
}));

import { DashboardHistorical } from "./DashboardHistorical";

const makeModel = ({
  isEmpty = false,
  qualityFlags = [],
  yoy = {},
}: {
  isEmpty?: boolean;
  qualityFlags?: DashboardHistoryModel["qualityFlags"];
  yoy?: Partial<DashboardHistoryModel["kpis"]["yoyClosedYears"]>;
} = {}): DashboardHistoryModel => ({
  meta: {
    businessTimezone: "Europe/Rome",
    asOfDate: "2026-02-28",
    asOfDateLabel: "28/02/2026",
    currentYear: 2026,
    latestClosedYear: 2025,
    firstYearWithData: 2024,
    lastYearWithData: 2025,
    totalYears: 3,
    hasCurrentYearData: false,
    hasFutureServices: false,
  },
  kpis: {
    totalHistoricalRevenue: 23700,
    bestClosedYear: {
      year: 2025,
      revenue: 20582,
    },
    latestClosedYearRevenue: {
      year: 2025,
      revenue: 20582,
    },
    yoyClosedYears: {
      valuePct: 560,
      formattedValue: "+560%",
      comparisonLabel: "2025 vs 2024",
      isComparable: true,
      ...yoy,
    },
  },
  yearlyRevenue: [
    {
      year: 2024,
      label: "2024",
      revenue: 3118,
      totalKm: 0,
      kmCost: 0,
      isClosedYear: true,
      isYtd: false,
    },
    {
      year: 2025,
      label: "2025",
      revenue: 20582,
      totalKm: 0,
      kmCost: 0,
      isClosedYear: true,
      isYtd: false,
    },
    {
      year: 2026,
      label: "2026 finora",
      revenue: 0,
      totalKm: 0,
      kmCost: 0,
      isClosedYear: false,
      isYtd: true,
    },
  ],
  categoryMix: {
    series: [],
    points: [],
  },
  topClients: [],
  qualityFlags,
  isEmpty,
});

describe("DashboardHistorical", () => {
  it("renders the global error state and retries loading", () => {
    const refetch = vi.fn();

    mockUseHistoricalDashboardData.mockReturnValue({
      data: null,
      isPending: false,
      error: new Error("boom"),
      refetch,
      sectionState: {
        categoryMix: { isPending: false, error: null },
        topClients: { isPending: false, error: null },
      },
    });

    renderWithQueryClient(<DashboardHistorical />);

    expect(
      screen.getByText("Impossibile caricare lo storico aziendale."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("renders the empty historical state", () => {
    mockUseHistoricalDashboardData.mockReturnValue({
      data: makeModel({ isEmpty: true }),
      isPending: false,
      error: null,
      refetch: vi.fn(),
      sectionState: {
        categoryMix: { isPending: false, error: null },
        topClients: { isPending: false, error: null },
      },
    });

    renderWithQueryClient(<DashboardHistorical />);

    expect(
      screen.getByText(
        "Storico non disponibile: nessun servizio registrato fino al 28/02/2026.",
      ),
    ).toBeInTheDocument();
  });

  it("renders contextual YoY warnings when closed years are insufficient", () => {
    mockUseHistoricalDashboardData.mockReturnValue({
      data: makeModel({
        qualityFlags: ["insufficient_closed_years"],
        yoy: {
          valuePct: null,
          formattedValue: "N/D",
          comparisonLabel: "2025 vs anno precedente",
          isComparable: false,
          reason: "insufficient_closed_years",
        },
      }),
      isPending: false,
      error: null,
      refetch: vi.fn(),
      sectionState: {
        categoryMix: { isPending: false, error: null },
        topClients: { isPending: false, error: null },
      },
    });

    renderWithQueryClient(<DashboardHistorical />);

    expect(screen.getByText("Tradotto in semplice")).toBeInTheDocument();
    expect(
      screen.getByText("Spiegazione semplice dei numeri"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "La crescita va letta solo tra anni completi: 2025 vs anno precedente.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Per misurare la crescita tra un anno e l'altro servono almeno due anni completi.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("historical-cash-inflow-card"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("historical-ai-summary-card"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("historical-cash-inflow-ai-card"),
    ).toBeInTheDocument();
  });
});
