import { getCategoryLabel } from "./dashboardModel";

export type AnalyticsHistoryMetaRow = {
  id: number | string;
  business_timezone: string;
  as_of_date: string;
  current_year: number | string;
  latest_closed_year: number | string | null;
  first_year_with_data: number | string | null;
  last_year_with_data: number | string | null;
  total_years: number | string;
  has_current_year_data: boolean;
  has_future_services: boolean;
};

export type AnalyticsYearlyCompetenceRevenueRow = {
  id: number | string;
  year: number | string;
  is_closed_year: boolean;
  is_ytd: boolean;
  as_of_date: string;
  revenue: number | string | null;
  total_km: number | string | null;
  km_cost: number | string | null;
  services_count: number | string | null;
  projects_count: number | string | null;
  clients_count: number | string | null;
};

export type AnalyticsYearlyCompetenceRevenueByCategoryRow = {
  id: number | string;
  year: number | string;
  category: string;
  is_closed_year: boolean;
  is_ytd: boolean;
  as_of_date: string;
  revenue: number | string | null;
  services_count: number | string | null;
  projects_count: number | string | null;
};

export type AnalyticsClientLifetimeCompetenceRevenueRow = {
  id: number | string;
  client_id: number | string;
  client_name: string;
  first_service_date?: string | null;
  last_service_date?: string | null;
  lifetime_revenue: number | string | null;
  active_years_count: number | string | null;
  projects_count: number | string | null;
  services_count: number | string | null;
};

export type HistoricalQualityFlag =
  | "no_historical_services"
  | "insufficient_closed_years"
  | "zero_baseline"
  | "future_services_excluded"
  | "partial_current_year";

export type HistoricalRevenuePoint = {
  year: number;
  label: string;
  revenue: number;
  totalKm: number;
  kmCost: number;
  isClosedYear: boolean;
  isYtd: boolean;
};

export type HistoricalCategorySeries = {
  key: string;
  label: string;
};

export type HistoricalCategoryMixPoint = {
  year: number;
  label: string;
  isClosedYear: boolean;
  isYtd: boolean;
  values: Record<string, number>;
};

export type HistoricalTopClientPoint = {
  clientId: string;
  clientName: string;
  revenue: number;
  firstServiceDate?: string | null;
  lastServiceDate?: string | null;
  activeYearsCount: number;
  projectsCount: number;
  servicesCount: number;
};

export type HistoricalYoY = {
  valuePct: number | null;
  formattedValue: string;
  comparisonLabel: string;
  isComparable: boolean;
  reason?: "insufficient_closed_years" | "zero_baseline";
};

export type DashboardHistoryModel = {
  meta: {
    businessTimezone: string;
    asOfDate: string;
    asOfDateLabel: string;
    currentYear: number;
    latestClosedYear: number | null;
    firstYearWithData: number | null;
    lastYearWithData: number | null;
    totalYears: number;
    hasCurrentYearData: boolean;
    hasFutureServices: boolean;
  };
  kpis: {
    totalHistoricalRevenue: number;
    bestClosedYear: {
      year: number | null;
      revenue: number | null;
    };
    latestClosedYearRevenue: {
      year: number | null;
      revenue: number | null;
    };
    yoyClosedYears: HistoricalYoY;
  };
  yearlyRevenue: HistoricalRevenuePoint[];
  categoryMix: {
    series: HistoricalCategorySeries[];
    points: HistoricalCategoryMixPoint[];
  };
  topClients: HistoricalTopClientPoint[];
  qualityFlags: HistoricalQualityFlag[];
  isEmpty: boolean;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toNullableInt = (value: unknown) => {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

const formatAsOfDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString("it-IT");
};

const formatYearLabel = (year: number, isYtd: boolean) =>
  isYtd ? `${year} finora` : `${year}`;

const pushQualityFlag = (
  flags: HistoricalQualityFlag[],
  flag: HistoricalQualityFlag,
) => {
  if (!flags.includes(flag)) {
    flags.push(flag);
  }
};

export const buildDashboardHistoryModel = ({
  meta,
  yearlyRevenueRows,
  categoryRows,
  clientRows,
}: {
  meta: AnalyticsHistoryMetaRow;
  yearlyRevenueRows: AnalyticsYearlyCompetenceRevenueRow[];
  categoryRows: AnalyticsYearlyCompetenceRevenueByCategoryRow[];
  clientRows: AnalyticsClientLifetimeCompetenceRevenueRow[];
}): DashboardHistoryModel => {
  const currentYear = toNumber(meta.current_year);
  const latestClosedYear = toNullableInt(meta.latest_closed_year);
  const firstYearWithData = toNullableInt(meta.first_year_with_data);
  const lastYearWithData = toNullableInt(meta.last_year_with_data);
  const totalYears = toNumber(meta.total_years);

  const yearlyRevenue = yearlyRevenueRows
    .map((row) => ({
      year: toNumber(row.year),
      label: formatYearLabel(toNumber(row.year), row.is_ytd),
      revenue: toNumber(row.revenue),
      totalKm: toNumber(row.total_km),
      kmCost: toNumber(row.km_cost),
      isClosedYear: row.is_closed_year,
      isYtd: row.is_ytd,
    }))
    .sort((a, b) => a.year - b.year);

  const totalHistoricalRevenue = yearlyRevenue.reduce(
    (sum, row) => sum + row.revenue,
    0,
  );
  const closedYearRows = yearlyRevenue.filter((row) => row.isClosedYear);
  const bestClosedYearRow =
    closedYearRows.length > 0
      ? [...closedYearRows].sort((a, b) =>
          b.revenue !== a.revenue ? b.revenue - a.revenue : b.year - a.year,
        )[0]
      : null;
  const latestClosedYearRow =
    closedYearRows.length > 0
      ? [...closedYearRows].sort((a, b) => b.year - a.year)[0]
      : null;
  const previousClosedYearRow =
    closedYearRows.length > 1
      ? [...closedYearRows].sort((a, b) => b.year - a.year)[1]
      : null;

  const qualityFlags: HistoricalQualityFlag[] = [];
  if (totalHistoricalRevenue === 0) {
    pushQualityFlag(qualityFlags, "no_historical_services");
  }
  if (yearlyRevenue.some((row) => row.isYtd)) {
    pushQualityFlag(qualityFlags, "partial_current_year");
  }
  if (meta.has_future_services) {
    pushQualityFlag(qualityFlags, "future_services_excluded");
  }

  let yoyClosedYears: HistoricalYoY;
  if (!latestClosedYearRow || !previousClosedYearRow) {
    pushQualityFlag(qualityFlags, "insufficient_closed_years");
    yoyClosedYears = {
      valuePct: null,
      formattedValue: "N/D",
      comparisonLabel: latestClosedYearRow
        ? `${latestClosedYearRow.year} vs anno precedente`
        : "Servono due anni chiusi",
      isComparable: false,
      reason: "insufficient_closed_years",
    };
  } else if (previousClosedYearRow.revenue === 0) {
    pushQualityFlag(qualityFlags, "zero_baseline");
    yoyClosedYears = {
      valuePct: null,
      formattedValue: "N/D",
      comparisonLabel: `${latestClosedYearRow.year} vs ${previousClosedYearRow.year}`,
      isComparable: false,
      reason: "zero_baseline",
    };
  } else {
    const valuePct =
      ((latestClosedYearRow.revenue - previousClosedYearRow.revenue) /
        previousClosedYearRow.revenue) *
      100;
    yoyClosedYears = {
      valuePct,
      formattedValue: `${valuePct > 0 ? "+" : ""}${Math.round(valuePct)}%`,
      comparisonLabel: `${latestClosedYearRow.year} vs ${previousClosedYearRow.year}`,
      isComparable: true,
    };
  }

  const categoryTotals = new Map<string, number>();
  const categoryRowsByYear = new Map<number, Map<string, number>>();
  const yearMeta = new Map<number, { isClosedYear: boolean; isYtd: boolean }>();
  for (const row of categoryRows) {
    const year = toNumber(row.year);
    const revenue = toNumber(row.revenue);
    categoryTotals.set(
      row.category,
      (categoryTotals.get(row.category) ?? 0) + revenue,
    );

    const yearValues =
      categoryRowsByYear.get(year) ?? new Map<string, number>();
    yearValues.set(row.category, revenue);
    categoryRowsByYear.set(year, yearValues);

    if (!yearMeta.has(year)) {
      yearMeta.set(year, {
        isClosedYear: row.is_closed_year,
        isYtd: row.is_ytd,
      });
    }
  }

  const categorySeries = Array.from(categoryTotals.entries())
    .filter(([, revenue]) => revenue > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => ({
      key,
      label: getCategoryLabel(key),
    }));

  const categoryMixPoints =
    categorySeries.length > 0
      ? yearlyRevenue.map((row) => {
          const values =
            categoryRowsByYear.get(row.year) ?? new Map<string, number>();
          return {
            year: row.year,
            label: row.label,
            isClosedYear:
              yearMeta.get(row.year)?.isClosedYear ?? row.isClosedYear,
            isYtd: yearMeta.get(row.year)?.isYtd ?? row.isYtd,
            values: Object.fromEntries(
              categorySeries.map((series) => [
                series.key,
                values.get(series.key) ?? 0,
              ]),
            ),
          };
        })
      : [];

  const topClients = clientRows
    .map((row) => ({
      clientId: String(row.client_id),
      clientName: row.client_name,
      revenue: toNumber(row.lifetime_revenue),
      firstServiceDate: row.first_service_date ?? null,
      lastServiceDate: row.last_service_date ?? null,
      activeYearsCount: toNumber(row.active_years_count),
      projectsCount: toNumber(row.projects_count),
      servicesCount: toNumber(row.services_count),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    meta: {
      businessTimezone: meta.business_timezone,
      asOfDate: meta.as_of_date,
      asOfDateLabel: formatAsOfDate(meta.as_of_date),
      currentYear,
      latestClosedYear,
      firstYearWithData,
      lastYearWithData,
      totalYears,
      hasCurrentYearData: meta.has_current_year_data,
      hasFutureServices: meta.has_future_services,
    },
    kpis: {
      totalHistoricalRevenue,
      bestClosedYear: {
        year: bestClosedYearRow?.year ?? null,
        revenue: bestClosedYearRow?.revenue ?? null,
      },
      latestClosedYearRevenue: {
        year: latestClosedYearRow?.year ?? null,
        revenue: latestClosedYearRow?.revenue ?? null,
      },
      yoyClosedYears,
    },
    yearlyRevenue,
    categoryMix: {
      series: categorySeries,
      points: categoryMixPoints,
    },
    topClients,
    qualityFlags,
    isEmpty:
      totalHistoricalRevenue === 0 &&
      !meta.has_current_year_data &&
      firstYearWithData == null &&
      lastYearWithData == null,
  };
};
