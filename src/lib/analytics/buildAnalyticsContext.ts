import type { DashboardHistoryModel } from "@/components/atomic-crm/dashboard/dashboardHistoryModel";

import { getAnalyticsMetricDefinition } from "./analyticsDefinitions";

export type AnalyticsContext = {
  meta: {
    businessTimezone: string;
    asOfDate: string;
    currentYear: number;
    latestClosedYear: number | null;
    firstYearWithData: number | null;
    lastYearWithData: number | null;
    hasFutureServices: boolean;
    hasCurrentYearData: boolean;
  };
  metrics: Array<{
    id: string;
    label: string;
    value: number | null;
    formattedValue: string;
    comparisonLabel?: string;
    basis: "competence_revenue" | "cash_inflow";
    isYtd: boolean;
    isComparable: boolean;
    subtitle: string;
    warningCode?: string;
  }>;
  series: {
    yearlyRevenue: Array<{
      year: number;
      revenue: number;
      isClosedYear: boolean;
      isYtd: boolean;
    }>;
    yearlyRevenueByCategory: Array<{
      year: number;
      category: string;
      revenue: number;
    }>;
  };
  qualityFlags: string[];
  caveats: string[];
};

const pushCaveat = (caveats: string[], value: string) => {
  if (!caveats.includes(value)) {
    caveats.push(value);
  }
};

export const buildAnalyticsContext = (
  model: DashboardHistoryModel,
): AnalyticsContext => {
  const totalDefinition = getAnalyticsMetricDefinition(
    "historical_total_competence_revenue",
  )!;
  const bestDefinition = getAnalyticsMetricDefinition("best_closed_year")!;
  const latestDefinition = getAnalyticsMetricDefinition(
    "latest_closed_year_revenue",
  )!;
  const yoyDefinition = getAnalyticsMetricDefinition("yoy_closed_years")!;
  const caveats: string[] = [];

  pushCaveat(caveats, "Tutti i valori storici sono compensi per competenza (data lavoro), non incassi. La simulazione fiscale annuale usa invece il principio di cassa (data incasso).");
  pushCaveat(
    caveats,
    `${model.meta.currentYear} è trattato come YTD al ${model.meta.asOfDateLabel}.`,
  );

  if (model.kpis.yoyClosedYears.isComparable) {
    pushCaveat(
      caveats,
      `Il confronto YoY valido usa solo anni chiusi: ${model.kpis.yoyClosedYears.comparisonLabel}.`,
    );
  } else if (model.kpis.yoyClosedYears.reason === "insufficient_closed_years") {
    pushCaveat(
      caveats,
      "Il YoY non è dimostrabile con i dati disponibili: servono almeno due anni chiusi.",
    );
  } else if (model.kpis.yoyClosedYears.reason === "zero_baseline") {
    pushCaveat(
      caveats,
      `Il YoY ${model.kpis.yoyClosedYears.comparisonLabel} non è dimostrabile con i dati disponibili: l'anno base vale 0.`,
    );
  }

  if (model.qualityFlags.includes("future_services_excluded")) {
    pushCaveat(
      caveats,
      `I servizi futuri oltre il ${model.meta.asOfDateLabel} sono esclusi dal calcolo.`,
    );
  }

  if (model.qualityFlags.includes("no_historical_services")) {
    pushCaveat(
      caveats,
      `Non risultano servizi storici fino al ${model.meta.asOfDateLabel}.`,
    );
  }

  return {
    meta: {
      businessTimezone: model.meta.businessTimezone,
      asOfDate: model.meta.asOfDate,
      currentYear: model.meta.currentYear,
      latestClosedYear: model.meta.latestClosedYear,
      firstYearWithData: model.meta.firstYearWithData,
      lastYearWithData: model.meta.lastYearWithData,
      hasFutureServices: model.meta.hasFutureServices,
      hasCurrentYearData: model.meta.hasCurrentYearData,
    },
    metrics: [
      {
        id: totalDefinition.id,
        label: totalDefinition.label,
        value: model.kpis.totalHistoricalRevenue,
        formattedValue: model.kpis.totalHistoricalRevenue.toLocaleString("it-IT", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        }),
        basis: totalDefinition.basis,
        isYtd: true,
        isComparable: true,
        subtitle: totalDefinition.defaultSubtitle,
      },
      {
        id: bestDefinition.id,
        label: bestDefinition.label,
        value: model.kpis.bestClosedYear.revenue,
        formattedValue:
          model.kpis.bestClosedYear.revenue == null
            ? "N/D"
            : model.kpis.bestClosedYear.revenue.toLocaleString("it-IT", {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 0,
              }),
        comparisonLabel:
          model.kpis.bestClosedYear.year == null
            ? undefined
            : String(model.kpis.bestClosedYear.year),
        basis: bestDefinition.basis,
        isYtd: false,
        isComparable: model.kpis.bestClosedYear.revenue != null,
        subtitle: bestDefinition.defaultSubtitle,
      },
      {
        id: latestDefinition.id,
        label: latestDefinition.label,
        value: model.kpis.latestClosedYearRevenue.revenue,
        formattedValue:
          model.kpis.latestClosedYearRevenue.revenue == null
            ? "N/D"
            : model.kpis.latestClosedYearRevenue.revenue.toLocaleString(
                "it-IT",
                {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                },
              ),
        comparisonLabel:
          model.kpis.latestClosedYearRevenue.year == null
            ? undefined
            : String(model.kpis.latestClosedYearRevenue.year),
        basis: latestDefinition.basis,
        isYtd: false,
        isComparable: model.kpis.latestClosedYearRevenue.revenue != null,
        subtitle: latestDefinition.defaultSubtitle,
      },
      {
        id: yoyDefinition.id,
        label: yoyDefinition.label,
        value: model.kpis.yoyClosedYears.valuePct,
        formattedValue: model.kpis.yoyClosedYears.formattedValue,
        comparisonLabel: model.kpis.yoyClosedYears.comparisonLabel,
        basis: yoyDefinition.basis,
        isYtd: false,
        isComparable: model.kpis.yoyClosedYears.isComparable,
        subtitle: yoyDefinition.defaultSubtitle,
        warningCode: model.kpis.yoyClosedYears.reason,
      },
    ],
    series: {
      yearlyRevenue: model.yearlyRevenue.map((point) => ({
        year: point.year,
        revenue: point.revenue,
        isClosedYear: point.isClosedYear,
        isYtd: point.isYtd,
      })),
      yearlyRevenueByCategory: model.categoryMix.points.flatMap((point) =>
        Object.entries(point.values).map(([category, revenue]) => ({
          year: point.year,
          category,
          revenue,
        })),
      ),
    },
    qualityFlags: model.qualityFlags,
    caveats,
  };
};
