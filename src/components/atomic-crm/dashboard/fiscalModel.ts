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
import { buildDeadlines } from "./fiscalDeadlines";
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
  FiscalWarning,
} from "./fiscalModelTypes";

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

  // Build category → ATECO profile mapping
  const categoryToProfile = new Map<
    string,
    (typeof fiscalConfig.taxProfiles)[0]
  >();
  for (const profile of fiscalConfig.taxProfiles) {
    for (const cat of profile.linkedCategories) {
      categoryToProfile.set(cat, profile);
    }
  }

  // ── Operational revenue by category (competence basis) ────────────
  // Used for margins, DSO, and operational health KPIs.
  // NOT used for fiscal base — see cash-basis section below.

  const categoryRevenue = new Map<string, number>();
  const categoryExpenses = new Map<string, number>();
  const clientRevenue = new Map<string, number>();
  const projectEarliestService = new Map<string, string>();
  const clientEarliestFlatService = new Map<string, string>();
  const defaultTaxProfile = fiscalConfig.taxProfiles[0];

  for (const service of services) {
    if (!service.service_date) continue;
    const serviceDateIso = toBusinessISODate(service.service_date);
    if (!serviceDateIso || getBusinessYear(service.service_date) !== currentYear)
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

  // ── Cash-basis fiscal revenue (current year) ────────────────────
  // Regime forfettario: la base imponibile è la somma degli INCASSI
  // effettivamente ricevuti nell'anno (principio di cassa), NON il
  // fatturato emesso o i servizi erogati (principio di competenza).
  // Rif. normativo: Art. 1 commi 54-89, L. 190/2014.

  const taxableCashRevenue = new Map<string, number>();
  let fatturatoTotaleYtd = 0;
  const taxDefaults = fiscalConfig.taxabilityDefaults;

  for (const payment of payments) {
    if (payment.status !== "ricevuto") continue;
    if (!payment.payment_date) continue;
    if (getBusinessYear(payment.payment_date) !== currentYear) continue;

    // Rimborsi al cliente riducono la base imponibile
    const isRefund = payment.payment_type === "rimborso";
    const amount = isRefund
      ? -toNumber(payment.amount)
      : toNumber(payment.amount);

    fatturatoTotaleYtd += amount;

    // Check non-taxable via config defaults
    let isTaxable = true;
    if (taxDefaults) {
      if (
        taxDefaults.nonTaxableClientIds?.includes(String(payment.client_id))
      ) {
        isTaxable = false;
      } else if (payment.project_id) {
        const proj = projectById.get(String(payment.project_id));
        if (proj && taxDefaults.nonTaxableCategories?.includes(proj.category)) {
          isTaxable = false;
        }
      }
    }

    if (!isTaxable) continue;

    // Map payment to ATECO category via project
    const project = payment.project_id
      ? projectById.get(String(payment.project_id))
      : null;

    if (!project) {
      const fallbackKey = defaultTaxProfile
        ? `__flat_payments_${defaultTaxProfile.atecoCode}`
        : "__flat_payments_unclassified";
      if (defaultTaxProfile) {
        categoryToProfile.set(fallbackKey, defaultTaxProfile);
      }
      taxableCashRevenue.set(
        fallbackKey,
        (taxableCashRevenue.get(fallbackKey) ?? 0) + amount,
      );
      continue;
    }

    const category = project.category;
    taxableCashRevenue.set(
      category,
      (taxableCashRevenue.get(category) ?? 0) + amount,
    );
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

  // ── Fiscal KPIs ───────────────────────────────────────────────────

  const aliquotaSostitutiva = getAliquotaSostitutiva(fiscalConfig, currentYear);
  let fatturatoLordoYtd = 0;
  let redditoLordoForfettario = 0;
  let unclassifiedRevenue = 0;

  const atecoTotals = new Map<
    string,
    { fatturato: number; redditoForfettario: number }
  >();

  for (const [cat, revenue] of taxableCashRevenue) {
    fatturatoLordoYtd += revenue;
    const profile = categoryToProfile.get(cat);
    if (profile) {
      const reddito = revenue * (profile.coefficienteReddititivita / 100);
      redditoLordoForfettario += reddito;
      const key = profile.atecoCode;
      const bucket = atecoTotals.get(key) ?? {
        fatturato: 0,
        redditoForfettario: 0,
      };
      bucket.fatturato += revenue;
      bucket.redditoForfettario += reddito;
      atecoTotals.set(key, bucket);
    } else {
      unclassifiedRevenue += revenue;
    }
  }

  const stimaInpsAnnuale =
    redditoLordoForfettario * (fiscalConfig.aliquotaINPS / 100);
  const redditoImponibile = Math.max(
    0,
    redditoLordoForfettario - stimaInpsAnnuale,
  );
  const stimaImpostaAnnuale = redditoImponibile * (aliquotaSostitutiva / 100);
  const redditoNettoStimato =
    fatturatoLordoYtd - stimaInpsAnnuale - stimaImpostaAnnuale;
  const percentualeNetto =
    fatturatoLordoYtd > 0 ? (redditoNettoStimato / fatturatoLordoYtd) * 100 : 0;
  const accantonamentoMensile = (stimaInpsAnnuale + stimaImpostaAnnuale) / 12;
  const tettoFatturato =
    fiscalConfig.tettoFatturato > 0 ? fiscalConfig.tettoFatturato : 85000;
  const distanzaDalTetto = tettoFatturato - fatturatoLordoYtd;
  const percentualeUtilizzoTetto =
    tettoFatturato > 0 ? (fatturatoLordoYtd / tettoFatturato) * 100 : 0;
  const fatturatoNonTassabileYtd = Math.max(
    0,
    fatturatoTotaleYtd - fatturatoLordoYtd,
  );

  // ── ATECO breakdown ───────────────────────────────────────────────

  const atecoBreakdown: AtecoBreakdownPoint[] = fiscalConfig.taxProfiles.map(
    (profile) => {
      const bucket = atecoTotals.get(profile.atecoCode);
      return {
        atecoCode: profile.atecoCode,
        description: profile.description,
        coefficiente: profile.coefficienteReddititivita,
        fatturato: bucket?.fatturato ?? 0,
        redditoForfettario: bucket?.redditoForfettario ?? 0,
        categories: profile.linkedCategories,
      };
    },
  );

  // ── Deadlines ─────────────────────────────────────────────────────

  const deadlines = buildDeadlines({
    stimaImpostaAnnuale,
    stimaInpsAnnuale,
    annoInizioAttivita: fiscalConfig.annoInizioAttivita,
    currentYear,
    todayIso,
  });

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

  // ── Warnings ──────────────────────────────────────────────────────

  const warnings: FiscalWarning[] = [];
  if (unclassifiedRevenue > 0) {
    warnings.push({
      type: "unclassified_revenue",
      message: `${Math.round(unclassifiedRevenue).toLocaleString("it-IT")} € di fatturato non classificato. Collega le categorie mancanti in Impostazioni → Fiscale.`,
      amount: unclassifiedRevenue,
    });
  }
  if (distanzaDalTetto < 0 && fatturatoLordoYtd < 100000) {
    warnings.push({
      type: "ceiling_exceeded",
      message: "Tetto superato: uscita dal forfettario dall'anno prossimo",
    });
  }
  if (fatturatoLordoYtd >= 100000) {
    warnings.push({
      type: "ceiling_critical",
      message: "Superamento 100K: uscita IMMEDIATA dal regime forfettario",
    });
  }

  return {
    fiscalKpis: {
      fatturatoLordoYtd,
      fatturatoTotaleYtd,
      fatturatoNonTassabileYtd,
      redditoLordoForfettario,
      stimaInpsAnnuale,
      redditoImponibile,
      stimaImpostaAnnuale,
      redditoNettoStimato,
      percentualeNetto,
      accantonamentoMensile,
      distanzaDalTetto,
      percentualeUtilizzoTetto,
      aliquotaSostitutiva,
      monthsOfData,
    },
    atecoBreakdown,
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
    warnings,
  };
};
