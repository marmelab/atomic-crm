import { type AnalyticsContext } from "@/lib/analytics/buildAnalyticsContext";
import { type AnnualOperationsContext } from "@/lib/analytics/buildAnnualOperationsContext";
import { type HistoricalCashInflowContext } from "@/lib/analytics/buildHistoricalCashInflowContext";
import {
  type AnnualOperationsAnalyticsAnswer,
  type AnnualOperationsAnalyticsSummary,
} from "@/lib/analytics/annualAnalysis";
import {
  type HistoricalAnalyticsAnswer,
  type HistoricalAnalyticsSummary,
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
    async generateHistoricalAnalyticsSummary(): Promise<HistoricalAnalyticsSummary> {
      const [context, model] = await Promise.all([
        historicalContext(),
        deps.getConfiguredHistoricalAnalysisModel(),
      ]);

      const { data, error } = await deps.invokeEdgeFunction<{
        data: HistoricalAnalyticsSummary;
      }>("historical_analytics_summary", {
        method: "POST",
        body: { context, model },
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
    async generateHistoricalCashInflowSummary(): Promise<HistoricalAnalyticsSummary> {
      const [context, model] = await Promise.all([
        cashInflowContext(),
        deps.getConfiguredHistoricalAnalysisModel(),
      ]);

      const { data, error } = await deps.invokeEdgeFunction<{
        data: HistoricalAnalyticsSummary;
      }>("historical_cash_inflow_summary", {
        method: "POST",
        body: { context, model },
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
    ): Promise<AnnualOperationsAnalyticsSummary> {
      const [context, model] = await Promise.all([
        annualContext(year),
        deps.getConfiguredHistoricalAnalysisModel(),
      ]);

      const { data, error } = await deps.invokeEdgeFunction<{
        data: AnnualOperationsAnalyticsSummary;
      }>("annual_operations_summary", {
        method: "POST",
        body: { context, model },
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
    ): Promise<HistoricalAnalyticsAnswer> {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion) {
        throw new Error("Scrivi una domanda prima di inviare la richiesta.");
      }

      const [context, model] = await Promise.all([
        historicalContext(),
        deps.getConfiguredHistoricalAnalysisModel(),
      ]);

      const { data, error } = await deps.invokeEdgeFunction<{
        data: HistoricalAnalyticsAnswer;
      }>("historical_analytics_answer", {
        method: "POST",
        body: { context, question: trimmedQuestion, model },
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
    ): Promise<HistoricalAnalyticsAnswer> {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion) {
        throw new Error("Scrivi una domanda prima di inviare la richiesta.");
      }

      const [context, model] = await Promise.all([
        cashInflowContext(),
        deps.getConfiguredHistoricalAnalysisModel(),
      ]);

      const { data, error } = await deps.invokeEdgeFunction<{
        data: HistoricalAnalyticsAnswer;
      }>("historical_cash_inflow_answer", {
        method: "POST",
        body: { context, question: trimmedQuestion, model },
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
    ): Promise<AnnualOperationsAnalyticsAnswer> {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion) {
        throw new Error("Scrivi una domanda prima di inviare la richiesta.");
      }

      const [context, model] = await Promise.all([
        annualContext(year),
        deps.getConfiguredHistoricalAnalysisModel(),
      ]);

      const { data, error } = await deps.invokeEdgeFunction<{
        data: AnnualOperationsAnalyticsAnswer;
      }>("annual_operations_answer", {
        method: "POST",
        body: { context, question: trimmedQuestion, model },
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
