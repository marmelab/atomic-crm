import { type AnalyticsContext } from "@/lib/analytics/buildAnalyticsContext";
import { type AnnualOperationsContext } from "@/lib/analytics/buildAnnualOperationsContext";
import { type HistoricalCashInflowContext } from "@/lib/analytics/buildHistoricalCashInflowContext";
import {
  type AnnualOperationsAnalyticsAnswer,
  type AnnualOperationsAnalyticsSummary,
  type AnnualOperationsVisualAnswer,
  type AnnualOperationsVisualSummary,
} from "@/lib/analytics/annualAnalysis";
import {
  type HistoricalAnalyticsAnswer,
  type HistoricalAnalyticsSummary,
  type HistoricalVisualAnswer,
  type HistoricalVisualSummary,
} from "@/lib/analytics/historicalAnalysis";
import { extractEdgeFunctionErrorMessage } from "./edgeFunctionError";
import type { BaseProvider, InvokeEdgeFunction } from "./dataProviderTypes";
import {
  getHistoricalAnalyticsContextFromViews,
  getHistoricalCashInflowContextFromViews,
  getAnnualOperationsContextFromResources,
} from "./dataProviderAnalyticsContext";

export const buildAnalyticsProviderMethods = (deps: {
  baseDataProvider: BaseProvider;
  invokeEdgeFunction: InvokeEdgeFunction;
  getConfiguredHistoricalAnalysisModel: () => Promise<string>;
}) => {
  const historicalContext = () =>
    getHistoricalAnalyticsContextFromViews(deps.baseDataProvider);
  const cashInflowContext = () =>
    getHistoricalCashInflowContextFromViews(deps.baseDataProvider);
  const annualContext = (year: number) =>
    getAnnualOperationsContextFromResources(deps.baseDataProvider, year);

  return {
    async getHistoricalAnalyticsContext(): Promise<AnalyticsContext> {
      return historicalContext();
    },
    async getHistoricalCashInflowContext(): Promise<HistoricalCashInflowContext> {
      return cashInflowContext();
    },
    async getAnnualOperationsAnalyticsContext(
      year: number,
    ): Promise<AnnualOperationsContext> {
      return annualContext(year);
    },
    async generateHistoricalAnalyticsSummary(options?: {
      visualMode?: boolean;
    }): Promise<HistoricalAnalyticsSummary | HistoricalVisualSummary> {
      const [context, model] = await Promise.all([
        historicalContext(),
        deps.getConfiguredHistoricalAnalysisModel(),
      ]);

      const { data, error } = await deps.invokeEdgeFunction<{
        data: HistoricalAnalyticsSummary | HistoricalVisualSummary;
      }>("historical_analytics_summary", {
        method: "POST",
        body: { context, model, visualMode: options?.visualMode ?? false },
      });

      if (!data || error) {
        console.error("generateHistoricalAnalyticsSummary.error", error);
        throw new Error(
          await extractEdgeFunctionErrorMessage(
            error,
            "Impossibile generare l'analisi AI dello storico",
          ),
        );
      }

      return data.data;
    },
    async generateHistoricalCashInflowSummary(options?: {
      visualMode?: boolean;
    }): Promise<HistoricalAnalyticsSummary | HistoricalVisualSummary> {
      const [context, model] = await Promise.all([
        cashInflowContext(),
        deps.getConfiguredHistoricalAnalysisModel(),
      ]);

      const { data, error } = await deps.invokeEdgeFunction<{
        data: HistoricalAnalyticsSummary | HistoricalVisualSummary;
      }>("historical_cash_inflow_summary", {
        method: "POST",
        body: { context, model, visualMode: options?.visualMode ?? false },
      });

      if (!data || error) {
        console.error("generateHistoricalCashInflowSummary.error", error);
        throw new Error(
          await extractEdgeFunctionErrorMessage(
            error,
            "Impossibile generare l'analisi AI degli incassi storici",
          ),
        );
      }

      return data.data;
    },
    async generateAnnualOperationsAnalyticsSummary(
      year: number,
      options?: { visualMode?: boolean },
    ): Promise<
      AnnualOperationsAnalyticsSummary | AnnualOperationsVisualSummary
    > {
      const [context, model] = await Promise.all([
        annualContext(year),
        deps.getConfiguredHistoricalAnalysisModel(),
      ]);

      const { data, error } = await deps.invokeEdgeFunction<{
        data: AnnualOperationsAnalyticsSummary | AnnualOperationsVisualSummary;
      }>("annual_operations_summary", {
        method: "POST",
        body: { context, model, visualMode: options?.visualMode ?? false },
      });

      if (!data || error) {
        console.error("generateAnnualOperationsAnalyticsSummary.error", error);
        throw new Error(
          await extractEdgeFunctionErrorMessage(
            error,
            "Impossibile generare l'analisi AI della vista Annuale",
          ),
        );
      }

      return data.data;
    },
    async askHistoricalAnalyticsQuestion(
      question: string,
      options?: { visualMode?: boolean },
    ): Promise<HistoricalAnalyticsAnswer | HistoricalVisualAnswer> {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion) {
        throw new Error("Scrivi una domanda prima di inviare la richiesta.");
      }

      const [context, model] = await Promise.all([
        historicalContext(),
        deps.getConfiguredHistoricalAnalysisModel(),
      ]);

      const { data, error } = await deps.invokeEdgeFunction<{
        data: HistoricalAnalyticsAnswer | HistoricalVisualAnswer;
      }>("historical_analytics_answer", {
        method: "POST",
        body: {
          context,
          question: trimmedQuestion,
          model,
          visualMode: options?.visualMode ?? false,
        },
      });

      if (!data || error) {
        console.error("askHistoricalAnalyticsQuestion.error", error);
        throw new Error(
          await extractEdgeFunctionErrorMessage(
            error,
            "Impossibile ottenere una risposta AI sullo storico",
          ),
        );
      }

      return data.data;
    },
    async askHistoricalCashInflowQuestion(
      question: string,
      options?: { visualMode?: boolean },
    ): Promise<HistoricalAnalyticsAnswer | HistoricalVisualAnswer> {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion) {
        throw new Error("Scrivi una domanda prima di inviare la richiesta.");
      }

      const [context, model] = await Promise.all([
        cashInflowContext(),
        deps.getConfiguredHistoricalAnalysisModel(),
      ]);

      const { data, error } = await deps.invokeEdgeFunction<{
        data: HistoricalAnalyticsAnswer | HistoricalVisualAnswer;
      }>("historical_cash_inflow_answer", {
        method: "POST",
        body: {
          context,
          question: trimmedQuestion,
          model,
          visualMode: options?.visualMode ?? false,
        },
      });

      if (!data || error) {
        console.error("askHistoricalCashInflowQuestion.error", error);
        throw new Error(
          await extractEdgeFunctionErrorMessage(
            error,
            "Impossibile ottenere una risposta AI sugli incassi storici",
          ),
        );
      }

      return data.data;
    },
    async askAnnualOperationsQuestion(
      year: number,
      question: string,
      options?: { visualMode?: boolean },
    ): Promise<AnnualOperationsAnalyticsAnswer | AnnualOperationsVisualAnswer> {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion) {
        throw new Error("Scrivi una domanda prima di inviare la richiesta.");
      }

      const [context, model] = await Promise.all([
        annualContext(year),
        deps.getConfiguredHistoricalAnalysisModel(),
      ]);

      const { data, error } = await deps.invokeEdgeFunction<{
        data: AnnualOperationsAnalyticsAnswer | AnnualOperationsVisualAnswer;
      }>("annual_operations_answer", {
        method: "POST",
        body: {
          context,
          question: trimmedQuestion,
          model,
          visualMode: options?.visualMode ?? false,
        },
      });

      if (!data || error) {
        console.error("askAnnualOperationsQuestion.error", error);
        throw new Error(
          await extractEdgeFunctionErrorMessage(
            error,
            "Impossibile ottenere una risposta AI sulla vista Annuale",
          ),
        );
      }

      return data.data;
    },
  };
};
