import {
  diffBusinessDays,
  formatBusinessDate,
  getBusinessYear,
  startOfBusinessDayISOString,
} from "./dateTimezone.ts";

export type FiscalTaxProfile = {
  atecoCode: string;
  description?: string;
  coefficienteReddititivita: number;
  linkedCategories: string[];
};

export type TaxabilityDefaultsConfig = {
  nonTaxableCategories: string[];
  nonTaxableClientIds: string[];
};

export type FiscalConfig = {
  taxProfiles: FiscalTaxProfile[];
  defaultTaxProfileAtecoCode: string;
  aliquotaINPS: number;
  tettoFatturato: number;
  annoInizioAttivita: number;
  taxabilityDefaults?: TaxabilityDefaultsConfig;
  aliquotaOverride?: number | null;
};

export type PaymentRow = {
  amount: number;
  payment_date: string | null;
  status: string | null;
  project_id: string | null;
  client_id: string | null;
  payment_type: string | null;
};

export type ProjectRow = {
  id: string;
  category: string | null;
};

export type FiscalWarningCode =
  | "UNMAPPED_TAX_PROFILE"
  | "CEILING_EXCEEDED"
  | "CEILING_CRITICAL";

export type FiscalWarning = {
  code: FiscalWarningCode;
  severity: "warning" | "critical";
  message: string;
  amount?: number;
  taxYear?: number;
  paymentYear?: number;
};

export type FiscalKpis = {
  taxYear: number;
  fatturatoLordoYtd: number;
  fatturatoTotaleYtd: number;
  fatturatoNonTassabileYtd: number;
  unmappedCashRevenue: number;
  redditoLordoForfettario: number;
  stimaInpsAnnuale: number;
  redditoImponibile: number;
  stimaImpostaAnnuale: number;
  redditoNettoStimato: number;
  percentualeNetto: number;
  accantonamentoMensile: number;
  distanzaDalTetto: number;
  percentualeUtilizzoTetto: number;
  aliquotaSostitutiva: number;
  monthsOfData: number;
};

export type FiscalEstimateScheduleInput = {
  taxYear: number;
  annualInpsEstimate: number;
  annualSubstituteTaxEstimate: number;
};

export type FiscalScheduleMethod = "historical";
export type FiscalScheduleConfidence = "estimated";

export type FiscalScheduleAssumptions = {
  configMode: "current_config_reapplied";
  paymentTrackingMode: "local_non_authoritative";
};

export type FiscalDeadlineComponent =
  | "imposta_saldo"
  | "imposta_acconto_1"
  | "imposta_acconto_2"
  | "imposta_acconto_unico"
  | "inps_saldo"
  | "inps_acconto_1"
  | "inps_acconto_2"
  | "bollo"
  | "dichiarazione";

export type DeadlineItem = {
  description: string;
  amount: number;
  competenceYear: number | null;
  component: FiscalDeadlineComponent;
};

export type FiscalDeadline = {
  paymentYear: number;
  method: FiscalScheduleMethod;
  supportingTaxYears: number[];
  confidence: FiscalScheduleConfidence;
  assumptions: FiscalScheduleAssumptions;
  date: string;
  label: string;
  items: DeadlineItem[];
  totalAmount: number;
  isPast: boolean;
  daysUntil: number;
  priority: "high" | "low";
};

export type FiscalPaymentSchedule = {
  paymentYear: number;
  basisTaxYear: number;
  isFirstYear: boolean;
  supportingTaxYears: number[];
  method: FiscalScheduleMethod;
  confidence: FiscalScheduleConfidence;
  assumptions: FiscalScheduleAssumptions;
  deadlines: FiscalDeadline[];
};

export type FiscalAdvancePlan = {
  paymentYear: number;
  competenceYear: number;
  juneItems: DeadlineItem[];
  novemberItems: DeadlineItem[];
  substituteTaxAdvanceTotal: number;
  inpsAdvanceTotal: number;
};

export type FiscalTaskPayload = {
  text: string;
  type: "f24" | "inps" | "bollo" | "dichiarazione";
  due_date: string;
  done_date: null;
  client_id: null;
};

export type FiscalYearEstimateBuildResult = {
  fiscalKpis: FiscalKpis;
  warnings: FiscalWarning[];
  scheduleInput: FiscalEstimateScheduleInput;
};

export type FiscalReminderComputation = {
  estimate: FiscalYearEstimateBuildResult;
  priorAdvanceEstimate: FiscalYearEstimateBuildResult;
  schedule: FiscalPaymentSchedule;
  warnings: FiscalWarning[];
};

const SCHEDULE_METHOD: FiscalScheduleMethod = "historical";
const SCHEDULE_CONFIDENCE: FiscalScheduleConfidence = "estimated";
const SCHEDULE_ASSUMPTIONS: FiscalScheduleAssumptions = {
  configMode: "current_config_reapplied",
  paymentTrackingMode: "local_non_authoritative",
};
const MIN_SUBSTITUTE_TAX_ADVANCE = 51.65;
const DOUBLE_SUBSTITUTE_TAX_ADVANCE_THRESHOLD = 257.52;

const isoDate = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export const roundFiscalOutput = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const formatCompetenceYear = (value: number | null) =>
  value == null ? "none" : String(value);

export const buildFiscalDeadlineKey = (
  deadline: Pick<FiscalDeadline, "paymentYear" | "date" | "method" | "items">,
) => {
  const itemsKey = [...deadline.items]
    .map(
      (item) =>
        `${item.component}:${formatCompetenceYear(item.competenceYear)}`,
    )
    .sort()
    .join("|");

  return [
    String(deadline.paymentYear),
    deadline.date,
    deadline.method,
    itemsKey,
  ].join("::");
};

const normalizeAtecoCode = (value: string | null | undefined) => value?.trim();

const getValidFiscalTaxProfiles = (
  taxProfiles: FiscalTaxProfile[] | null | undefined,
) =>
  (taxProfiles ?? []).filter((profile) =>
    Boolean(normalizeAtecoCode(profile.atecoCode)),
  );

const isValidFiscalTaxProfileAtecoCode = (
  atecoCode: string | null | undefined,
  taxProfiles: FiscalTaxProfile[] | null | undefined,
) => {
  const normalizedCode = normalizeAtecoCode(atecoCode);
  if (!normalizedCode) return false;
  return getValidFiscalTaxProfiles(taxProfiles).some(
    (profile) => profile.atecoCode === normalizedCode,
  );
};

const getAliquotaSostitutiva = (
  config: FiscalConfig,
  currentYear: number,
): number => {
  if (config.aliquotaOverride != null) return config.aliquotaOverride;
  const yearsActive = currentYear - config.annoInizioAttivita;
  return yearsActive < 5 ? 5 : 15;
};

const getSignedPaymentAmount = (payment: PaymentRow) => {
  const amount = Number(payment.amount || 0);
  return payment.payment_type === "rimborso" ? -amount : amount;
};

const buildCategoryToProfileMap = (taxProfiles: FiscalTaxProfile[]) => {
  const categoryToProfile = new Map<string, FiscalTaxProfile>();

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
  payment: PaymentRow;
  projectById: Map<string, ProjectRow>;
  taxDefaults: FiscalConfig["taxabilityDefaults"];
}) => {
  if (!taxDefaults) return false;

  if (
    payment.client_id &&
    taxDefaults.nonTaxableClientIds?.includes(String(payment.client_id))
  ) {
    return true;
  }

  if (!payment.project_id) {
    return false;
  }

  const project = projectById.get(String(payment.project_id));
  if (!project?.category) {
    return false;
  }

  return taxDefaults.nonTaxableCategories?.includes(project.category) ?? false;
};

const inferActivityStartYearFromPayments = (payments: PaymentRow[]) => {
  const years = payments
    .map((payment) => payment.payment_date)
    .filter((value): value is string => Boolean(value))
    .map((value) => getBusinessYear(value))
    .filter((value): value is number => value != null)
    .sort((left, right) => left - right);

  return years[0] ?? null;
};

export const buildFiscalYearEstimate = ({
  payments,
  projects,
  fiscalConfig,
  taxYear,
  monthsOfData = 12,
}: {
  payments: PaymentRow[];
  projects: ProjectRow[];
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
        taxDefaults: fiscalConfig.taxabilityDefaults,
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

  for (const profile of validTaxProfiles) {
    const rawRevenue = taxableCashRevenuePerAteco.get(profile.atecoCode) ?? 0;
    const basis = Math.max(0, rawRevenue);
    forfettarioIncome += basis * (profile.coefficienteReddititivita / 100);
  }

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
    warnings,
    scheduleInput: {
      taxYear,
      annualInpsEstimate,
      annualSubstituteTaxEstimate,
    },
  };
};

const getSupportingTaxYears = (items: DeadlineItem[]) =>
  Array.from(
    new Set(
      items
        .map((item) => item.competenceYear)
        .filter((year): year is number => year != null),
    ),
  ).sort((a, b) => a - b);

const buildDeadlineTiming = (date: string, todayIso: string) => {
  const daysUntil = diffBusinessDays(todayIso, date) ?? 0;

  return {
    isPast: daysUntil < 0,
    daysUntil,
  };
};

const makeDeadline = ({
  paymentYear,
  date,
  label,
  items,
  priority,
  todayIso,
}: {
  paymentYear: number;
  date: string;
  label: string;
  items: DeadlineItem[];
  priority: "high" | "low";
  todayIso: string;
}): FiscalDeadline => {
  const normalizedItems = items.map((item) => ({
    ...item,
    amount: roundFiscalOutput(item.amount),
  }));
  const timing = buildDeadlineTiming(date, todayIso);

  return {
    paymentYear,
    method: SCHEDULE_METHOD,
    supportingTaxYears: getSupportingTaxYears(normalizedItems),
    confidence: SCHEDULE_CONFIDENCE,
    assumptions: SCHEDULE_ASSUMPTIONS,
    date,
    label,
    items: normalizedItems,
    totalAmount: roundFiscalOutput(
      normalizedItems.reduce((sum, item) => sum + item.amount, 0),
    ),
    isPast: timing.isPast,
    daysUntil: timing.daysUntil,
    priority,
  };
};

const sortDeadlines = (deadlines: FiscalDeadline[]) =>
  [...deadlines].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority === "high" ? -1 : 1;
    }

    if (left.date !== right.date) {
      return left.date.localeCompare(right.date);
    }

    return left.label.localeCompare(right.label);
  });

const resolveActivityStartYear = ({
  configuredStartYear,
  inferredStartYear,
  paymentYear,
}: {
  configuredStartYear: number | null | undefined;
  inferredStartYear?: number | null;
  paymentYear: number;
}) => {
  if (
    configuredStartYear != null &&
    Number.isFinite(configuredStartYear) &&
    configuredStartYear >= 2000 &&
    configuredStartYear <= paymentYear
  ) {
    return configuredStartYear;
  }

  if (
    inferredStartYear != null &&
    Number.isFinite(inferredStartYear) &&
    inferredStartYear >= 2000 &&
    inferredStartYear <= paymentYear
  ) {
    return inferredStartYear;
  }

  return paymentYear;
};

const buildLowPriorityDeadlines = (
  paymentYear: number,
  todayIso: string,
): FiscalDeadline[] => {
  const deadlines: FiscalDeadline[] = [];

  const bolloQuarters = [
    { date: isoDate(paymentYear, 5, 31), label: "Bollo Q1 (gen-mar)" },
    { date: isoDate(paymentYear, 9, 30), label: "Bollo Q2 (apr-giu)" },
    { date: isoDate(paymentYear, 11, 30), label: "Bollo Q3 (lug-set)" },
    { date: isoDate(paymentYear + 1, 2, 28), label: "Bollo Q4 (ott-dic)" },
  ];

  for (const bollo of bolloQuarters) {
    deadlines.push(
      makeDeadline({
        paymentYear,
        date: bollo.date,
        label: bollo.label,
        items: [
          {
            description: `Imposta di bollo fatture elettroniche — ${bollo.label}`,
            amount: 0,
            competenceYear: paymentYear,
            component: "bollo",
          },
        ],
        priority: "low",
        todayIso,
      }),
    );
  }

  deadlines.push(
    makeDeadline({
      paymentYear,
      date: isoDate(paymentYear, 10, 31),
      label: "Dichiarazione dei redditi",
      items: [
        {
          description: "Invio telematico Modello Redditi PF",
          amount: 0,
          competenceYear: paymentYear - 1,
          component: "dichiarazione",
        },
      ],
      priority: "low",
      todayIso,
    }),
  );

  return deadlines;
};

export const buildAdvancePlanFromEstimate = ({
  estimate,
}: {
  estimate: FiscalEstimateScheduleInput;
}): FiscalAdvancePlan => {
  const competenceYear = estimate.taxYear + 1;
  const paymentYear = competenceYear;

  const juneItems: DeadlineItem[] = [];
  const novemberItems: DeadlineItem[] = [];

  const hasDoubleAcconto =
    estimate.annualSubstituteTaxEstimate >
    DOUBLE_SUBSTITUTE_TAX_ADVANCE_THRESHOLD;
  const hasSingleAcconto =
    estimate.annualSubstituteTaxEstimate >= MIN_SUBSTITUTE_TAX_ADVANCE &&
    !hasDoubleAcconto;

  if (hasDoubleAcconto) {
    juneItems.push({
      description: "1° Acconto Imposta Sostitutiva (50%)",
      amount: estimate.annualSubstituteTaxEstimate * 0.5,
      competenceYear,
      component: "imposta_acconto_1",
    });
    novemberItems.push({
      description: "2° Acconto Imposta Sostitutiva (50%)",
      amount: estimate.annualSubstituteTaxEstimate * 0.5,
      competenceYear,
      component: "imposta_acconto_2",
    });
  } else if (hasSingleAcconto) {
    novemberItems.push({
      description: "Acconto Unico Imposta Sostitutiva (100%)",
      amount: estimate.annualSubstituteTaxEstimate,
      competenceYear,
      component: "imposta_acconto_unico",
    });
  }

  if (estimate.annualInpsEstimate > 0) {
    juneItems.push({
      description: "1° Acconto INPS Gestione Separata (40%)",
      amount: estimate.annualInpsEstimate * 0.4,
      competenceYear,
      component: "inps_acconto_1",
    });
    novemberItems.push({
      description: "2° Acconto INPS Gestione Separata (40%)",
      amount: estimate.annualInpsEstimate * 0.4,
      competenceYear,
      component: "inps_acconto_2",
    });
  }

  return {
    paymentYear,
    competenceYear,
    juneItems,
    novemberItems,
    substituteTaxAdvanceTotal: roundFiscalOutput(
      [...juneItems, ...novemberItems]
        .filter((item) => item.component.startsWith("imposta_"))
        .reduce((sum, item) => sum + item.amount, 0),
    ),
    inpsAdvanceTotal: roundFiscalOutput(
      [...juneItems, ...novemberItems]
        .filter((item) => item.component.startsWith("inps_"))
        .reduce((sum, item) => sum + item.amount, 0),
    ),
  };
};

export const buildFiscalPaymentSchedule = ({
  paymentYear,
  basisEstimate,
  priorAdvancePlan,
  annoInizioAttivita,
  inferredActivityStartYear,
  todayIso,
}: {
  paymentYear: number;
  basisEstimate: FiscalEstimateScheduleInput;
  priorAdvancePlan: FiscalAdvancePlan | null;
  annoInizioAttivita: number | null | undefined;
  inferredActivityStartYear?: number | null;
  todayIso: string;
}): FiscalPaymentSchedule => {
  const highPriorityDeadlines: FiscalDeadline[] = [];
  const activityStartYear = resolveActivityStartYear({
    configuredStartYear: annoInizioAttivita,
    inferredStartYear: inferredActivityStartYear,
    paymentYear,
  });
  const isFirstYear = paymentYear <= activityStartYear;
  const isSecondYear = paymentYear === activityStartYear + 1;
  const currentAdvancePlan = buildAdvancePlanFromEstimate({
    estimate: basisEstimate,
  });

  if (!isFirstYear) {
    const previousSubstituteTaxAdvances = isSecondYear
      ? 0
      : (priorAdvancePlan?.substituteTaxAdvanceTotal ?? 0);
    const previousInpsAdvances = isSecondYear
      ? 0
      : (priorAdvancePlan?.inpsAdvanceTotal ?? 0);

    const juneItems: DeadlineItem[] = [];
    const residualSubstituteTaxSaldo = Math.max(
      0,
      basisEstimate.annualSubstituteTaxEstimate - previousSubstituteTaxAdvances,
    );
    const residualInpsSaldo = Math.max(
      0,
      basisEstimate.annualInpsEstimate - previousInpsAdvances,
    );

    if (residualSubstituteTaxSaldo > 0) {
      juneItems.push({
        description: "Saldo Imposta Sostitutiva anno precedente",
        amount: residualSubstituteTaxSaldo,
        competenceYear: paymentYear - 1,
        component: "imposta_saldo",
      });
    }

    if (residualInpsSaldo > 0) {
      juneItems.push({
        description: "Saldo INPS anno precedente",
        amount: residualInpsSaldo,
        competenceYear: paymentYear - 1,
        component: "inps_saldo",
      });
    }

    juneItems.push(...currentAdvancePlan.juneItems);

    if (juneItems.length > 0) {
      highPriorityDeadlines.push(
        makeDeadline({
          paymentYear,
          date: isoDate(paymentYear, 6, 30),
          label: "Saldo + 1° Acconto",
          items: juneItems,
          priority: "high",
          todayIso,
        }),
      );
    }

    if (currentAdvancePlan.novemberItems.length > 0) {
      highPriorityDeadlines.push(
        makeDeadline({
          paymentYear,
          date: isoDate(paymentYear, 11, 30),
          label: "2° Acconto",
          items: currentAdvancePlan.novemberItems,
          priority: "high",
          todayIso,
        }),
      );
    }
  }

  const lowPriorityDeadlines = buildLowPriorityDeadlines(paymentYear, todayIso);
  const deadlines = sortDeadlines([
    ...highPriorityDeadlines,
    ...lowPriorityDeadlines,
  ]);
  const supportingTaxYears = Array.from(
    new Set(deadlines.flatMap((deadline) => deadline.supportingTaxYears)),
  ).sort((a, b) => a - b);

  return {
    paymentYear,
    basisTaxYear: paymentYear - 1,
    isFirstYear,
    supportingTaxYears,
    method: SCHEDULE_METHOD,
    confidence: SCHEDULE_CONFIDENCE,
    assumptions: SCHEDULE_ASSUMPTIONS,
    deadlines,
  };
};

const dedupeWarnings = (warnings: FiscalWarning[]) => {
  const seen = new Set<string>();

  return warnings.filter((warning) => {
    const key = [
      warning.code,
      warning.taxYear ?? "na",
      warning.amount ?? "na",
      warning.paymentYear ?? "na",
    ].join("::");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

export const buildFiscalReminderComputation = ({
  config,
  payments,
  projects,
  paymentYear,
  todayIso,
  inferredActivityStartYear,
}: {
  config: FiscalConfig;
  payments: PaymentRow[];
  projects: ProjectRow[];
  paymentYear: number;
  todayIso: string;
  inferredActivityStartYear?: number | null;
}): FiscalReminderComputation => {
  const estimate = buildFiscalYearEstimate({
    payments,
    projects,
    fiscalConfig: config,
    taxYear: paymentYear - 1,
  });
  const priorAdvanceEstimate = buildFiscalYearEstimate({
    payments,
    projects,
    fiscalConfig: config,
    taxYear: paymentYear - 2,
  });
  const schedule = buildFiscalPaymentSchedule({
    paymentYear,
    basisEstimate: estimate.scheduleInput,
    priorAdvancePlan: buildAdvancePlanFromEstimate({
      estimate: priorAdvanceEstimate.scheduleInput,
    }),
    annoInizioAttivita: config.annoInizioAttivita,
    inferredActivityStartYear:
      inferredActivityStartYear ?? inferActivityStartYearFromPayments(payments),
    todayIso,
  });

  const warnings = dedupeWarnings(
    [...estimate.warnings, ...priorAdvanceEstimate.warnings].map((warning) => ({
      ...warning,
      paymentYear,
    })),
  );

  return {
    estimate,
    priorAdvanceEstimate,
    schedule,
    warnings,
  };
};

const inferTaskType = (
  component: FiscalDeadlineComponent,
): FiscalTaskPayload["type"] => {
  if (component.startsWith("inps")) return "inps";
  if (component === "bollo") return "bollo";
  if (component === "dichiarazione") return "dichiarazione";
  return "f24";
};

const formatEurAmount = (amount: number): string =>
  amount.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

export const buildTaskPayloads = (
  deadlines: FiscalDeadline[],
): FiscalTaskPayload[] => {
  const tasks: FiscalTaskPayload[] = [];

  for (const deadline of deadlines) {
    for (const item of deadline.items) {
      const amountNote =
        item.amount > 0 ? ` (${formatEurAmount(item.amount)})` : "";
      const estimatedSuffix = deadline.priority === "high" ? " (stimato)" : "";

      tasks.push({
        text: `${item.description}${estimatedSuffix}${amountNote}`,
        type: inferTaskType(item.component),
        due_date: startOfBusinessDayISOString(deadline.date) ?? deadline.date,
        done_date: null,
        client_id: null,
      });
    }
  }

  return tasks;
};

export const buildDeadlineNotificationMessage = (
  upcomingDeadlines: FiscalDeadline[],
): string => {
  const lines: string[] = ["Scadenze fiscali stimate in arrivo:", ""];

  for (const deadline of upcomingDeadlines) {
    const dateFormatted = formatBusinessDate(deadline.date, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const amountStr =
      deadline.totalAmount > 0
        ? ` - ${formatEurAmount(deadline.totalAmount)}`
        : "";
    lines.push(`${deadline.label} (${dateFormatted})${amountStr}`);

    for (const item of deadline.items) {
      const itemAmount =
        item.amount > 0 ? `: ${formatEurAmount(item.amount)}` : "";
      const estimatedSuffix = deadline.priority === "high" ? " (stimato)" : "";
      lines.push(`   - ${item.description}${estimatedSuffix}${itemAmount}`);
    }
  }

  return lines.join("\n");
};
