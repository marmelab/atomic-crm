// @vitest-environment jsdom

import "@/setupTests";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generateAnnualOperationsAnalyticsSummary = vi.fn();
const askAnnualOperationsQuestion = vi.fn();
const notify = vi.fn();

vi.mock("ra-core", async () => {
  const actual = await vi.importActual("ra-core");
  return {
    ...actual,
    useDataProvider: () => ({
      generateAnnualOperationsAnalyticsSummary,
      askAnnualOperationsQuestion,
    }),
    useNotify: () => notify,
  };
});

vi.mock("../root/ConfigurationContext", () => ({
  useConfigurationContext: () => ({
    aiConfig: {
      historicalAnalysisModel: "gpt-5.2",
    },
  }),
}));

import { DashboardAnnualAiSummaryCard } from "./DashboardAnnualAiSummaryCard";

const renderCard = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardAnnualAiSummaryCard year={2025} />
    </QueryClientProvider>,
  );
};

describe("DashboardAnnualAiSummaryCard", () => {
  beforeEach(() => {
    generateAnnualOperationsAnalyticsSummary.mockReset();
    askAnnualOperationsQuestion.mockReset();
    notify.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders primary summary button and suggested question chips", () => {
    renderCard();

    expect(
      screen.getByRole("button", { name: /Spiegami l'anno 2025/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Com'è andato?")).toBeInTheDocument();
    expect(screen.getByText("Quanto ho guadagnato?")).toBeInTheDocument();
    expect(screen.getByText("Chi ha portato valore?")).toBeInTheDocument();
    expect(screen.getByText("Dove ho speso troppo?")).toBeInTheDocument();
  });

  it("asks a suggested question and renders the answer", async () => {
    const questionText = `Com'è andato il 2025 rispetto al 2024? Confronta ricavi, clienti, margini.`;
    askAnnualOperationsQuestion.mockResolvedValue({
      question: questionText,
      model: "gpt-5.2",
      generatedAt: "2026-02-28T07:00:00.000Z",
      answerMarkdown:
        "## Risposta breve\nIl lavoro dell'anno e trainato soprattutto da Produzione TV.",
    });

    renderCard();

    fireEvent.click(screen.getByText("Com'è andato?"));

    await waitFor(() =>
      expect(askAnnualOperationsQuestion).toHaveBeenCalledWith(
        2025,
        questionText,
        { visualMode: true },
      ),
    );
    expect(
      await screen.findByText(
        "Il lavoro dell'anno e trainato soprattutto da Produzione TV.",
      ),
    ).toBeInTheDocument();
  });

  it("generates the guided annual summary", async () => {
    generateAnnualOperationsAnalyticsSummary.mockResolvedValue({
      model: "gpt-5.2",
      generatedAt: "2026-02-28T07:00:00.000Z",
      summaryMarkdown:
        "## In breve\nNel 2025 il lavoro dell'anno e concentrato su pochi clienti forti.",
    });

    renderCard();

    fireEvent.click(
      screen.getByRole("button", { name: /Spiegami l'anno 2025/ }),
    );

    await waitFor(() =>
      expect(generateAnnualOperationsAnalyticsSummary).toHaveBeenCalledWith(
        2025,
        { visualMode: true },
      ),
    );
    expect(
      await screen.findByText(
        "Nel 2025 il lavoro dell'anno e concentrato su pochi clienti forti.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText("Riassunto 2025")).toBeInTheDocument();
  });

  it("treats the selected year as current using Europe/Rome business date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T23:30:00.000Z"));

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardAnnualAiSummaryCard year={2027} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Sto crescendo?")).toBeInTheDocument();
    expect(screen.queryByText("Com'è andato?")).not.toBeInTheDocument();
  });
});
