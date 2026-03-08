// @vitest-environment jsdom

import "@/setupTests";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const generateAnnualOperationsAnalyticsSummary = vi.fn();
const askAnnualOperationsQuestion = vi.fn();
const notify = vi.fn();

vi.mock("ra-core", async () => {
  const actual = await vi.importActual<typeof import("ra-core")>("ra-core");
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

  it("renders annual summary action, guardrail, and suggested questions", () => {
    renderCard();

    expect(screen.getByText("AI: spiegami l'anno 2025")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Legge la parte operativa dell'anno scelto: valore del lavoro, clienti, categorie, spese, margine lordo, pagamenti da ricevere e preventivi aperti. Non include il simulatore fiscale ne gli alert di oggi.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cosa ha trainato il 2025?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "L'AI risponde usando solo i numeri operativi di Annuale. Se una cosa non e dimostrabile, te lo dice chiaramente e non tratta uno zero come un problema automatico.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Chiedi all'AI" }),
    ).toBeDisabled();
  });

  it("asks a suggested annual question and renders the answer", async () => {
    askAnnualOperationsQuestion.mockResolvedValue({
      question: "Cosa ha trainato il 2025?",
      model: "gpt-5.2",
      generatedAt: "2026-02-28T07:00:00.000Z",
      answerMarkdown:
        "## Risposta breve\nIl lavoro dell'anno e trainato soprattutto da Produzione TV.",
    });

    renderCard();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Cosa ha trainato il 2025?",
      }),
    );

    await waitFor(() =>
      expect(askAnnualOperationsQuestion).toHaveBeenCalledWith(
        2025,
        "Cosa ha trainato il 2025?",
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

    fireEvent.click(screen.getByRole("button", { name: "Spiegami Annuale" }));

    await waitFor(() =>
      expect(generateAnnualOperationsAnalyticsSummary).toHaveBeenCalledWith(
        2025,
      ),
    );
    expect(
      await screen.findByText(
        "Nel 2025 il lavoro dell'anno e concentrato su pochi clienti forti.",
      ),
    ).toBeInTheDocument();
  });
});
