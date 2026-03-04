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
  calculateTaxableServiceNetValue,
} from "@/lib/semantics/crmSemanticRegistry";

// ── Output types ──────────────────────────────────────────────────────

export type FiscalModel = {
  fiscalKpis: FiscalKpis;
  atecoBreakdown: AtecoBreakdownPoint[];
  deadlines: FiscalDeadline[];
  businessHealth: BusinessHealthKpis;
  warnings: FiscalWarning[];
};

export type FiscalKpis = {
  /** Somma compensi netti (fee_shooting + fee_editing + fee_other - discount) anno corrente. */
  fatturatoLordoYtd: number;
  /** Somma compensi netti complessivi anno corrente, inclusi servizi non tassabili. */
  fatturatoTotaleYtd: number;
  /** Quota non tassabile del fatturato operativo dell'anno. */
  fatturatoNonTassabileYtd: number;
  /** SUM(fatturato_categoria × coefficiente_ATECO / 100). */
  redditoLordoForfettario: number;
  /** reddito_lordo × aliquota_INPS / 100. */
  stimaInpsAnnuale: number;
  /** reddito_lordo - INPS. */
  redditoImponibile: number;
  /** reddito_imponibile × aliquota_sostitutiva / 100. */
  stimaImpostaAnnuale: number;
  /** fatturato - INPS - imposta. */
  redditoNettoStimato: number;
  /** (reddito_netto / fatturato) × 100. */
  percentualeNetto: number;
  /** (INPS + imposta) / 12. */
  accantonamentoMensile: number;
  /** tetto - fatturato YTD. */
  distanzaDalTetto: number;
  /** (fatturato / tetto) × 100. */
  percentualeUtilizzoTetto: number;
  /** Effective aliquota sostitutiva used for calculations. */
  aliquotaSostitutiva: number;
  /** Number of months of data available (for reliability indicator). */
  monthsOfData: number;
};

export type AtecoBreakdownPoint = {
  atecoCode: string;
  description: string;
  coefficiente: number;
  fatturato: number;
  redditoForfettario: number;
  categories: string[];
};

export type FiscalDeadline = {
  date: string;
  label: string;
  items: DeadlineItem[];
  totalAmount: number;
  isPast: boolean;
  daysUntil: number;
};

export type DeadlineItem = {
  description: string;
  amount: number;
};

export type BusinessHealthKpis = {
  marginPerCategory: CategoryMargin[];
  quoteConversionRate: number;
  quotesAccepted: number;
  quotesTotal: number;
  dso: number | null;
  clientConcentration: number;
  weightedPipelineValue: number;
};

export type CategoryMargin = {
  category: string;
  label: string;
  margin: number;
  revenue: number;
  expenses: number;
};

export type FiscalWarning = {
  type: "unclassified_revenue" | "ceiling_exceeded" | "ceiling_critical";
  message: string;
  amount?: number;
};

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
};

const getExpenseAmount = (expense: Expense) => {
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

const toStartOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Format a local Date as YYYY-MM-DD without UTC conversion (avoids off-by-one in timezones ahead of UTC). */
const toLocalISODate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const diffDays = (from: Date, to: Date) => {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor(
    (toStartOfDay(to).valueOf() - toStartOfDay(from).valueOf()) / msPerDay,
  );
};

const isInYear = (value: string | undefined, year: number) => {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return false;
  return date.getFullYear() === year;
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
  const now = new Date();
  const today = toStartOfDay(now);
  const nowYear = now.getFullYear();
  // Validate year: must be a reasonable value, default to current year
  const currentYear =
    year != null && Number.isFinite(year) && year >= 2000 && year <= nowYear
      ? year
      : nowYear;
  const isSelectedCurrentYear = currentYear === nowYear;
  // Past years have 12 months of complete data; current year uses months elapsed
  const currentMonth = isSelectedCurrentYear ? now.getMonth() + 1 : 12;
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

  // ── Revenue by category (current year) ────────────────────────────

  const categoryRevenue = new Map<string, number>();
  const taxableCategoryRevenue = new Map<string, number>();
  const categoryExpenses = new Map<string, number>();
  const clientRevenue = new Map<string, number>();
  const projectEarliestService = new Map<string, Date>();
  const defaultTaxProfile = fiscalConfig.taxProfiles[0];
  let fatturatoTotaleYtd = 0;

  for (const service of services) {
    if (!service.service_date) continue;
    const date = new Date(service.service_date);
    if (Number.isNaN(date.valueOf()) || date.getFullYear() !== currentYear)
      continue;
    const project = service.project_id
      ? projectById.get(String(service.project_id))
      : null;

    const revenue = calculateServiceNetValue(service);
    const taxableRevenue = calculateTaxableServiceNetValue(service);
    fatturatoTotaleYtd += revenue;

    if (!project) {
      const fallbackCategoryKey = defaultTaxProfile
        ? `__flat_services_${defaultTaxProfile.atecoCode}`
        : "__flat_services_unclassified";

      if (defaultTaxProfile) {
        categoryToProfile.set(fallbackCategoryKey, defaultTaxProfile);
      }

      taxableCategoryRevenue.set(
        fallbackCategoryKey,
        (taxableCategoryRevenue.get(fallbackCategoryKey) ?? 0) + taxableRevenue,
      );

      if (service.client_id) {
        const clientId = String(service.client_id);
        clientRevenue.set(
          clientId,
          (clientRevenue.get(clientId) ?? 0) + revenue,
        );
      }

      continue;
    }

    const category = project.category;
    categoryRevenue.set(
      category,
      (categoryRevenue.get(category) ?? 0) + revenue,
    );
    taxableCategoryRevenue.set(
      category,
      (taxableCategoryRevenue.get(category) ?? 0) + taxableRevenue,
    );

    const clientId = String(project.client_id);
    clientRevenue.set(clientId, (clientRevenue.get(clientId) ?? 0) + revenue);

    const projectId = String(service.project_id);
    const existing = projectEarliestService.get(projectId);
    if (!existing || date < existing) {
      projectEarliestService.set(projectId, date);
    }
  }

  // ── Expenses by category (current year) ───────────────────────────

  for (const expense of expenses) {
    if (!expense.expense_date) continue;
    const date = new Date(expense.expense_date);
    if (Number.isNaN(date.valueOf()) || date.getFullYear() !== currentYear)
      continue;
    if (expense.expense_type === "credito_ricevuto") continue; // credits reduce expenses
    if (!expense.project_id) continue;
    const project = projectById.get(String(expense.project_id));
    if (!project) continue;
    const cat = project.category;
    const amount = getExpenseAmount(expense);
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

  for (const [cat, revenue] of taxableCategoryRevenue) {
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
    today,
  });

  // ── Business Health KPIs ──────────────────────────────────────────

  // Margin per category
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
    if (!payment.project_id) continue;
    const payDate = new Date(payment.payment_date);
    if (Number.isNaN(payDate.valueOf())) continue;
    const earliestService = projectEarliestService.get(
      String(payment.project_id),
    );
    if (!earliestService) continue;
    const days = diffDays(earliestService, payDate);
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
    },
    warnings,
  };
};

// ── Deadlines builder ─────────────────────────────────────────────────

/**
 * Builds fiscal deadlines for regime forfettario.
 *
 * Acconti split: 50/50 (D.L. 124/2019 art. 58 for ISA/forfettari subjects).
 * INPS advances: 80% of estimated annual total.
 *
 * June 30: Saldo anno precedente + 1° acconto anno corrente
 * November 30: 2° acconto anno corrente (not installable)
 */
const buildDeadlines = ({
  stimaImpostaAnnuale,
  stimaInpsAnnuale,
  annoInizioAttivita,
  currentYear,
  today,
}: {
  stimaImpostaAnnuale: number;
  stimaInpsAnnuale: number;
  annoInizioAttivita: number;
  currentYear: number;
  today: Date;
}): FiscalDeadline[] => {
  // First year: no deadlines (no previous year to settle)
  if (annoInizioAttivita === currentYear) return [];

  const deadlines: FiscalDeadline[] = [];

  // Acconto thresholds for imposta sostitutiva
  const hasDoubleAcconto = stimaImpostaAnnuale > 257.52;
  const hasSingleAcconto = stimaImpostaAnnuale >= 51.65 && !hasDoubleAcconto;

  // June 30 deadline
  const juneDate = new Date(currentYear, 5, 30); // month is 0-indexed
  const juneItems: DeadlineItem[] = [];

  // Saldo imposta anno precedente (full estimate minus advances)
  juneItems.push({
    description: "Saldo Imposta Sostitutiva anno precedente",
    amount: stimaImpostaAnnuale,
  });

  // Saldo INPS anno precedente (20% not covered by advances)
  juneItems.push({
    description: "Saldo INPS anno precedente (20%)",
    amount: stimaInpsAnnuale * 0.2,
  });

  // 1° acconto imposta (50% if double, 0 if single — goes to November)
  if (hasDoubleAcconto) {
    juneItems.push({
      description: "1° Acconto Imposta Sostitutiva (50%)",
      amount: stimaImpostaAnnuale * 0.5,
    });
  }

  // 1° acconto INPS (40% of total = 80% × 50%)
  juneItems.push({
    description: "1° Acconto INPS Gestione Separata (40%)",
    amount: stimaInpsAnnuale * 0.4,
  });

  const juneTotalAmount = juneItems.reduce((s, i) => s + i.amount, 0);
  deadlines.push({
    date: toLocalISODate(juneDate),
    label: "Saldo + 1° Acconto",
    items: juneItems,
    totalAmount: juneTotalAmount,
    isPast: juneDate < today,
    daysUntil: diffDays(today, juneDate),
  });

  // November 30 deadline
  const novDate = new Date(currentYear, 10, 30);
  const novItems: DeadlineItem[] = [];

  if (hasDoubleAcconto) {
    novItems.push({
      description: "2° Acconto Imposta Sostitutiva (50%)",
      amount: stimaImpostaAnnuale * 0.5,
    });
  } else if (hasSingleAcconto) {
    novItems.push({
      description: "Acconto Unico Imposta Sostitutiva (100%)",
      amount: stimaImpostaAnnuale,
    });
  }

  // 2° acconto INPS (40% of total = 80% × 50%)
  novItems.push({
    description: "2° Acconto INPS Gestione Separata (40%)",
    amount: stimaInpsAnnuale * 0.4,
  });

  const novTotalAmount = novItems.reduce((s, i) => s + i.amount, 0);
  deadlines.push({
    date: toLocalISODate(novDate),
    label: "2° Acconto",
    items: novItems,
    totalAmount: novTotalAmount,
    isPast: novDate < today,
    daysUntil: diffDays(today, novDate),
  });

  return deadlines;
};
