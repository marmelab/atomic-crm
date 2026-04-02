import type {
  Client,
  Expense,
  FiscalConfig,
  Payment,
  Project,
  Quote,
  Service,
} from "../types";
import {
  calculateKmReimbursement,
  calculateServiceNetValue,
} from "@/lib/semantics/crmSemanticRegistry";
import {
  getValidFiscalTaxProfiles,
  isValidFiscalTaxProfileAtecoCode,
} from "@/lib/fiscalConfig";
import {
  buildAdvancePlanFromEstimate,
  buildFiscalPaymentSchedule,
  type FiscalEstimateScheduleInput,
} from "./fiscalDeadlines";
import {
  diffBusinessDays,
  getBusinessMonthIndex,
  getBusinessYear,
  todayISODate,
  toBusinessISODate,
} from "@/lib/dateTimezone";
import type {
  AtecoBreakdownPoint,
  BusinessHealthKpis,
  CategoryMargin,
  FiscalModel,
  FiscalKpis,
  FiscalWarning,
} from "./fiscalModelTypes";
import { roundFiscalOutput } from "./roundFiscalOutput";

// Re-export types for backward compatibility
export type {
  FiscalModel,
  FiscalKpis,
  AtecoBreakdownPoint,
  FiscalDeadline,
  DeadlineItem,
  BusinessHealthKpis,
  CategoryMargin,
  FiscalWarning,
} from "./fiscalModelTypes";

// ── Helpers ───────────────────────────────────────────────────────────

const toNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

/**
 * Determines the substitute tax rate based on the year the business started.
 * Startup rate: 5% for the first 5 years (opening year included).
 * From the 6th year: 15% (standard rate).
 * If the user set a manual override, use that.
 */
const getAliquotaSostitutiva = (
  config: FiscalConfig,
  currentYear: number,
): number => {
  if (config.aliquotaOverride != null) return config.aliquotaOverride;
  const yearsActive = currentYear - config.annoInizioAttivita;
  return yearsActive < 5 ? 5 : 15;
};

const ACCEPTED_STATUSES = new Set([
  "accettato",
  "acconto_ricevuto",
  "in_lavorazione",
  "completato",
  "saldato",
]);

const WEIGHTED_PIPELINE_STATUSES = new Set([
  "primo_contatto",
  "preventivo_inviato",
  "in_trattativa",
]);

const categoryLabels: Record<string, string> = {
  produzione_tv: "Produzione TV",
  spot: "Spot",
  wedding: "Wedding",
  evento_privato: "Evento privato",
  sviluppo_web: "Sviluppo web",
  __general: "Spese generali",
};

export const getExpenseAmount = (expense: Expense) => {
  if (expense.expense_type === "spostamento_km") {
    return calculateKmReimbursement({
      kmDistance: expense.km_distance,
      kmRate: expense.km_rate,
    });
  }
  const base = toNumber(expense.amount);
  const markup = toNumber(expense.markup_percent);
  return markup > 0 ? base * (1 + markup / 100) : base;
};

const isInYear = (value: string | undefined, year: number) => {
  if (!value) return false;
  return getBusinessYear(value) === year;
};

const getSignedPaymentAmount = (payment: Payment) => {
  const amount = toNumber(payment.amount);
  return payment.payment_type === "rimborso" ? -amount : amount;
};

const buildCategoryToProfileMap = (
  taxProfiles: FiscalConfig["taxProfiles"],
) => {
  const categoryToProfile = new Map<string, (typeof taxProfiles)[number]>();

  for (const profile of taxProfiles) {
    for (const category of profile.linkedCategories) {
      categoryToProfile.set(category, profile);
    }
  }

  return categoryToProfile;
};

const isPaymentExcludedByTaxabilityDefaults = ({
  payment,
  projectById,
  taxDefaults,
}: {
  payment: Payment;
  projectById: Map<string, Project>;
  taxDefaults: FiscalConfig["taxabilityDefaults"];
}) => {
  if (!taxDefaults) return false;

  if (taxDefaults.nonTaxableClientIds?.includes(String(payment.client_id))) {
    return true;
  }

  if (!payment.project_id) {
    return false;
  }

  const project = projectById.get(String(payment.project_id));
  if (!project) {
    return false;
  }

  return taxDefaults.nonTaxableCategories?.includes(project.category) ?? false;
};

const inferActivityStartYearFromPayments = (payments: Payment[]) => {
  const years = payments
    .map((payment) => payment.payment_date)
    .filter((value): value is string => Boolean(value))
    .map((value) => getBusinessYear(value))
    .filter((value): value is number => value != null)
    .sort((left, right) => left - right);

  return years[0] ?? null;
};

type FiscalYearEstimateBuildResult = {
  fiscalKpis: FiscalKpis;
  atecoBreakdown: AtecoBreakdownPoint[];
  warnings: FiscalWarning[];
  scheduleInput: FiscalEstimateScheduleInput;
};

export const buildFiscalYearEstimate = ({
  payments,
  projects,
  fiscalConfig,
  taxYear,
  monthsOfData = 12,
}: {
  payments: Payment[];
  projects: Project[];
  fiscalConfig: FiscalConfig;
  taxYear: number;
  monthsOfData?: number;
}): FiscalYearEstimateBuildResult => {
  const projectById = new Map(
    projects.map((project) => [String(project.id), project]),
  );
  const validTaxProfiles = getValidFiscalTaxProfiles(fiscalConfig.taxProfiles);
  const categoryToProfile = buildCategoryToProfileMap(validTaxProfiles);
  const profileByAtecoCode = new Map(
    validTaxProfiles.map((profile) => [profile.atecoCode, profile]),
  );
  const fallbackProfile = isValidFiscalTaxProfileAtecoCode(
    fiscalConfig.defaultTaxProfileAtecoCode,
    validTaxProfiles,
  )
    ? (profileByAtecoCode.get(fiscalConfig.defaultTaxProfileAtecoCode) ?? null)
    : null;
  const taxDefaults = fiscalConfig.taxabilityDefaults;
  const taxableCashRevenuePerAteco = new Map<string, number>();
  let mappedTaxableCashRevenue = 0;
  let totalCashRevenue = 0;
  let nonTaxableCashRevenue = 0;
  let unmappedCashRevenue = 0;

  for (const payment of payments) {
    if (payment.status !== "ricevuto") continue;
    if (!payment.payment_date) continue;
    if (getBusinessYear(payment.payment_date) !== taxYear) continue;

    const amount = getSignedPaymentAmount(payment);
    totalCashRevenue += amount;

    if (
      isPaymentExcludedByTaxabilityDefaults({
        payment,
        projectById,
        taxDefaults,
      })
    ) {
      nonTaxableCashRevenue += amount;
      continue;
    }

    const project = payment.project_id
      ? projectById.get(String(payment.project_id))
      : null;
    const mappedProfile =
      project?.category != null
        ? categoryToProfile.get(project.category)
        : null;
    const targetProfile = mappedProfile ?? fallbackProfile;

    if (!targetProfile) {
      unmappedCashRevenue += amount;
      continue;
    }

    mappedTaxableCashRevenue += amount;
    taxableCashRevenuePerAteco.set(
      targetProfile.atecoCode,
      (taxableCashRevenuePerAteco.get(targetProfile.atecoCode) ?? 0) + amount,
    );
  }

  const aliquotaSostitutiva = getAliquotaSostitutiva(fiscalConfig, taxYear);
  let forfettarioIncome = 0;
  const atecoBreakdown: AtecoBreakdownPoint[] = validTaxProfiles.map(
    (profile) => {
      const rawRevenue = taxableCashRevenuePerAteco.get(profile.atecoCode) ?? 0;
      const basis = Math.max(0, rawRevenue);
      const redditoForfettario =
        basis * (profile.coefficienteReddititivita / 100);
      forfettarioIncome += redditoForfettario;

      return {
        atecoCode: profile.atecoCode,
        description: profile.description,
        coefficiente: profile.coefficienteReddititivita,
        fatturato: roundFiscalOutput(rawRevenue),
        redditoForfettario: roundFiscalOutput(redditoForfettario),
        categories: profile.linkedCategories,
      };
    },
  );

  forfettarioIncome = Math.max(0, forfettarioIncome);
  const annualInpsEstimate = Math.max(
    0,
    forfettarioIncome * (fiscalConfig.aliquotaINPS / 100),
  );
  const taxableIncomeAfterInps = Math.max(
    0,
    forfettarioIncome - annualInpsEstimate,
  );
  const annualSubstituteTaxEstimate = Math.max(
    0,
    taxableIncomeAfterInps * (aliquotaSostitutiva / 100),
  );
  const annualTotalEstimate = annualInpsEstimate + annualSubstituteTaxEstimate;
  const monthlySetAside = annualTotalEstimate / 12;
  const netEstimatedCash = totalCashRevenue - annualTotalEstimate;
  const taxableExposureForCeiling = Math.max(
    0,
    mappedTaxableCashRevenue + unmappedCashRevenue,
  );
  const tettoFatturato =
    fiscalConfig.tettoFatturato > 0 ? fiscalConfig.tettoFatturato : 85000;
  const distanzaDalTetto = tettoFatturato - taxableExposureForCeiling;
  const percentualeUtilizzoTetto =
    tettoFatturato > 0 ? (taxableExposureForCeiling / tettoFatturato) * 100 : 0;
  const percentualeNetto =
    totalCashRevenue > 0 ? (netEstimatedCash / totalCashRevenue) * 100 : 0;
  const roundedUnmappedCashRevenue = roundFiscalOutput(unmappedCashRevenue);

  const warnings: FiscalWarning[] = [];
  if (roundedUnmappedCashRevenue !== 0) {
    warnings.push({
      code: "UNMAPPED_TAX_PROFILE",
      severity: "warning",
      message: `${roundedUnmappedCashRevenue.toLocaleString("it-IT", {
        style: "currency",
        currency: "EUR",
      })} di incassi tassabili non sono mappati a nessun profilo ATECO. Controlla il profilo fallback in Impostazioni -> Fiscale.`,
      amount: roundedUnmappedCashRevenue,
      taxYear,
    });
  }
  if (distanzaDalTetto < 0 && taxableExposureForCeiling < 100000) {
    warnings.push({
      code: "CEILING_EXCEEDED",
      severity: "warning",
      message: "Tetto superato: uscita dal forfettario dall'anno prossimo",
      taxYear,
    });
  }
  if (taxableExposureForCeiling >= 100000) {
    warnings.push({
      code: "CEILING_CRITICAL",
      severity: "critical",
      message: "Superamento 100K: uscita IMMEDIATA dal regime forfettario",
      taxYear,
    });
  }

  return {
    fiscalKpis: {
      taxYear,
      fatturatoLordoYtd: roundFiscalOutput(mappedTaxableCashRevenue),
      fatturatoTotaleYtd: roundFiscalOutput(totalCashRevenue),
      fatturatoNonTassabileYtd: roundFiscalOutput(nonTaxableCashRevenue),
      unmappedCashRevenue: roundedUnmappedCashRevenue,
      redditoLordoForfettario: roundFiscalOutput(forfettarioIncome),
      stimaInpsAnnuale: roundFiscalOutput(annualInpsEstimate),
      redditoImponibile: roundFiscalOutput(taxableIncomeAfterInps),
      stimaImpostaAnnuale: roundFiscalOutput(annualSubstituteTaxEstimate),
      redditoNettoStimato: roundFiscalOutput(netEstimatedCash),
      percentualeNetto: roundFiscalOutput(percentualeNetto),
      accantonamentoMensile: roundFiscalOutput(monthlySetAside),
      distanzaDalTetto: roundFiscalOutput(distanzaDalTetto),
      percentualeUtilizzoTetto: roundFiscalOutput(percentualeUtilizzoTetto),
      aliquotaSostitutiva: roundFiscalOutput(aliquotaSostitutiva),
      monthsOfData,
    },
    atecoBreakdown,
    warnings,
    scheduleInput: {
      taxYear,
      annualInpsEstimate,
      annualSubstituteTaxEstimate,
    },
  };
};

// ── Main builder ──────────────────────────────────────────────────────

export const buildFiscalModel = ({
  services,
  expenses,
  payments,
  quotes,
  projects,
  clients: _clients,
  fiscalConfig,
  year,
}: {
  services: Service[];
  expenses: Expense[];
  payments: Payment[];
  quotes: Quote[];
  projects: Project[];
  clients: Client[];
  fiscalConfig: FiscalConfig;
  year?: number;
}): FiscalModel => {
  const todayIso = todayISODate();
  const nowYear = Number(todayIso.slice(0, 4));
  // Validate year: must be a reasonable value, default to current year
  const currentYear =
    year != null && Number.isFinite(year) && year >= 2000 && year <= nowYear
      ? year
      : nowYear;
  const isSelectedCurrentYear = currentYear === nowYear;
  // Past years have 12 months of complete data; current year uses months elapsed
  const currentMonth = isSelectedCurrentYear
    ? (getBusinessMonthIndex(todayIso) ?? 0) + 1
    : 12;
  const monthsOfData = Math.max(1, currentMonth);
  const yearPayments = payments.filter((payment) =>
    isInYear(payment.payment_date ?? payment.created_at, currentYear),
  );
  const yearQuotes = quotes.filter((quote) =>
    isInYear(quote.created_at, currentYear),
  );

  const projectById = new Map(projects.map((p) => [String(p.id), p]));

  // ── Operational revenue by category (competence basis) ────────────
  // Used for margins, DSO, and operational health KPIs.
  // NOT used for fiscal base — see cash-basis section below.

  const categoryRevenue = new Map<string, number>();
  const categoryExpenses = new Map<string, number>();
  const clientRevenue = new Map<string, number>();
  const projectEarliestService = new Map<string, string>();
  const clientEarliestFlatService = new Map<string, string>();

  for (const service of services) {
    if (!service.service_date) continue;
    const serviceDateIso = toBusinessISODate(service.service_date);
    if (
      !serviceDateIso ||
      getBusinessYear(service.service_date) !== currentYear
    )
      continue;
    const project = service.project_id
      ? projectById.get(String(service.project_id))
      : null;

    const revenue = calculateServiceNetValue(service);

    if (!project) {
      if (service.client_id) {
        const clientId = String(service.client_id);
        clientRevenue.set(
          clientId,
          (clientRevenue.get(clientId) ?? 0) + revenue,
        );
        const existingFlat = clientEarliestFlatService.get(clientId);
        if (!existingFlat || serviceDateIso < existingFlat) {
          clientEarliestFlatService.set(clientId, serviceDateIso);
        }
      }
      continue;
    }

    const category = project.category;
    categoryRevenue.set(
      category,
      (categoryRevenue.get(category) ?? 0) + revenue,
    );

    const clientId = String(project.client_id);
    clientRevenue.set(clientId, (clientRevenue.get(clientId) ?? 0) + revenue);

    const projectId = String(service.project_id);
    const existing = projectEarliestService.get(projectId);
    if (!existing || serviceDateIso < existing) {
      projectEarliestService.set(projectId, serviceDateIso);
    }
  }

  // ── Expenses by category (current year) ───────────────────────────

  for (const expense of expenses) {
    if (!expense.expense_date) continue;
    if (getBusinessYear(expense.expense_date) !== currentYear) continue;
    if (expense.expense_type === "credito_ricevuto") continue; // credits reduce expenses
    const amount = getExpenseAmount(expense);
    if (!expense.project_id) {
      categoryExpenses.set(
        "__general",
        (categoryExpenses.get("__general") ?? 0) + amount,
      );
      continue;
    }
    const project = projectById.get(String(expense.project_id));
    if (!project) continue;
    const cat = project.category;
    categoryExpenses.set(cat, (categoryExpenses.get(cat) ?? 0) + amount);
  }

  const estimate = buildFiscalYearEstimate({
    payments,
    projects,
    fiscalConfig,
    taxYear: currentYear,
    monthsOfData,
  });
  const previousYearEstimate = buildFiscalYearEstimate({
    payments,
    projects,
    fiscalConfig,
    taxYear: currentYear - 1,
  });
  const twoYearsBackEstimate = buildFiscalYearEstimate({
    payments,
    projects,
    fiscalConfig,
    taxYear: currentYear - 2,
  });
  const schedule = buildFiscalPaymentSchedule({
    paymentYear: currentYear,
    basisEstimate: previousYearEstimate.scheduleInput,
    priorAdvancePlan: buildAdvancePlanFromEstimate({
      estimate: twoYearsBackEstimate.scheduleInput,
    }),
    annoInizioAttivita: fiscalConfig.annoInizioAttivita,
    inferredActivityStartYear: inferActivityStartYearFromPayments(payments),
    todayIso,
  });
  const deadlines = schedule.deadlines;

  // ── Business Health KPIs ──────────────────────────────────────────

  const allCategories = new Set([
    ...categoryRevenue.keys(),
    ...categoryExpenses.keys(),
  ]);
  const marginPerCategory: CategoryMargin[] = Array.from(allCategories)
    .map((cat) => {
      const rev = categoryRevenue.get(cat) ?? 0;
      const exp = categoryExpenses.get(cat) ?? 0;
      const margin = rev > 0 ? ((rev - exp) / rev) * 100 : 0;
      return {
        category: cat,
        label: categoryLabels[cat] ?? cat,
        margin,
        revenue: rev,
        expenses: exp,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // Quote conversion rate
  const quotesTotal = yearQuotes.length;
  const quotesAccepted = yearQuotes.filter((q) =>
    ACCEPTED_STATUSES.has(q.status),
  ).length;
  const quoteConversionRate =
    quotesTotal > 0 ? (quotesAccepted / quotesTotal) * 100 : 0;

  // DSO (Days Sales Outstanding)
  const dsoValues: number[] = [];
  for (const payment of yearPayments) {
    if (payment.status !== "ricevuto" || !payment.payment_date) continue;
    const earliestService = payment.project_id
      ? projectEarliestService.get(String(payment.project_id))
      : clientEarliestFlatService.get(String(payment.client_id));
    if (!earliestService) continue;
    const days = diffBusinessDays(earliestService, payment.payment_date);
    if (days == null) continue;
    if (days >= 0) dsoValues.push(days);
  }
  const dso =
    dsoValues.length > 0
      ? Math.round(dsoValues.reduce((a, b) => a + b, 0) / dsoValues.length)
      : null;

  // Client concentration (top 3 / total)
  const totalRevenue = Array.from(clientRevenue.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  const sortedClientRevenues = Array.from(clientRevenue.values()).sort(
    (a, b) => b - a,
  );
  const top3Revenue = sortedClientRevenues
    .slice(0, 3)
    .reduce((a, b) => a + b, 0);
  const clientConcentration =
    totalRevenue > 0 ? (top3Revenue / totalRevenue) * 100 : 0;

  // Weighted pipeline value
  const openQuotes = yearQuotes.filter((q) =>
    WEIGHTED_PIPELINE_STATUSES.has(q.status),
  );
  const conversionFactor = quoteConversionRate / 100;
  const weightedPipelineValue = openQuotes.reduce(
    (sum, q) => sum + toNumber(q.amount) * conversionFactor,
    0,
  );

  return {
    fiscalKpis: estimate.fiscalKpis,
    atecoBreakdown: estimate.atecoBreakdown,
    schedule,
    deadlines,
    businessHealth: {
      marginPerCategory,
      quoteConversionRate,
      quotesAccepted,
      quotesTotal,
      dso,
      clientConcentration,
      weightedPipelineValue,
    } satisfies BusinessHealthKpis,
    warnings: estimate.warnings,
  };
};
