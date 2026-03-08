// @vitest-environment jsdom

import "@/setupTests";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getHistoricalCashInflowContext = vi.fn();

vi.mock("ra-core", async () => {
  const actual = await vi.importActual<typeof import("ra-core")>("ra-core");
  return {
    ...actual,
    useDataProvider: () => ({
      getHistoricalCashInflowContext,
    }),
  };
});

import { DashboardHistoricalCashInflowCard } from "./DashboardHistoricalCashInflowCard";

const makeContext = () => ({
  meta: {
    businessTimezone: "Europe/Rome",
    asOfDate: "2026-02-28",
    currentYear: 2026,
    latestClosedYear: 2025,
    firstYearWithCashInflow: 2025,
    lastYearWithCashInflow: 2026,
  },
  metrics: [
    {
      id: "historical_total_cash_inflow",
      label: "Incassi storici totali",
      value: 23985.64,
      formattedValue: "23.986 €",
      basis: "cash_inflow" as const,
      isYtd: true,
      isComparable: true,
      subtitle: "Incassi ricevuti, inclusa la quota YTD dell'anno corrente.",
    },
    {
      id: "latest_closed_year_cash_inflow",
      label: "Ultimo anno chiuso incassato",
      value: 22241.64,
      formattedValue: "22.242 €",
      comparisonLabel: "2025",
      basis: "cash_inflow" as const,
      isYtd: false,
      isComparable: true,
      subtitle: "Ultimo anno chiuso disponibile per incassi ricevuti.",
    },
  ],
  series: {
    yearlyCashInflow: [
      {
        year: 2025,
        cashInflow: 22241.64,
        paymentsCount: 11,
        projectsCount: 9,
        clientsCount: 1,
        isClosedYear: true,
        isYtd: false,
      },
      {
        year: 2026,
        cashInflow: 1744,
        paymentsCount: 1,
        projectsCount: 1,
        clientsCount: 1,
        isClosedYear: false,
        isYtd: true,
      },
    ],
  },
  caveats: [
    "Questi valori sono incassi ricevuti, non compensi per competenza.",
  ],
});

const renderCard = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardHistoricalCashInflowCard />
    </QueryClientProvider>,
  );
};

describe("DashboardHistoricalCashInflowCard", () => {
  beforeEach(() => {
    getHistoricalCashInflowContext.mockReset();
  });

  it("renders the cash inflow summary card with Bambino layout", async () => {
    getHistoricalCashInflowContext.mockResolvedValue(makeContext());

    renderCard();

    expect(
      await screen.findByText("Incassi ricevuti"),
    ).toBeInTheDocument();
    expect(await screen.findByText("23.986 €")).toBeInTheDocument();
    // Latest closed year value appears in both the summary and the bar list
    expect(await screen.findByText("Totale storico")).toBeInTheDocument();
    expect(screen.getAllByText("2025").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the empty state when no historical cash inflow is available", async () => {
    getHistoricalCashInflowContext.mockResolvedValue({
      ...makeContext(),
      meta: {
        ...makeContext().meta,
        firstYearWithCashInflow: null,
        lastYearWithCashInflow: null,
      },
      metrics: [
        {
          ...makeContext().metrics[0],
          value: 0,
          formattedValue: "0 €",
        },
        {
          ...makeContext().metrics[1],
          value: null,
          formattedValue: "N/D",
          comparisonLabel: undefined,
          isComparable: false,
        },
      ],
      series: {
        yearlyCashInflow: [],
      },
    });

    renderCard();

    expect(
      await screen.findByText("Nessun incasso storico registrato."),
    ).toBeInTheDocument();
  });

  it("renders the error state and retries loading", async () => {
    getHistoricalCashInflowContext
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(makeContext());

    renderCard();

    expect(
      await screen.findByText("Impossibile caricare gli incassi storici."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));

    await waitFor(() =>
      expect(getHistoricalCashInflowContext).toHaveBeenCalledTimes(2),
    );
    expect(
      await screen.findByText("Incassi ricevuti"),
    ).toBeInTheDocument();
  });
});
