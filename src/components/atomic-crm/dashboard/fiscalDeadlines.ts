import { diffBusinessDays } from "@/lib/dateTimezone";

import { roundFiscalOutput } from "./roundFiscalOutput";
import type {
  DeadlineItem,
  FiscalDeadline,
  FiscalPaymentSchedule,
  FiscalScheduleAssumptions,
  FiscalScheduleConfidence,
  FiscalScheduleMethod,
} from "./fiscalModelTypes";

export type FiscalEstimateScheduleInput = {
  taxYear: number;
  annualInpsEstimate: number;
  annualSubstituteTaxEstimate: number;
};

export type FiscalAdvancePlan = {
  paymentYear: number;
  competenceYear: number;
  juneItems: DeadlineItem[];
  novemberItems: DeadlineItem[];
  substituteTaxAdvanceTotal: number;
  inpsAdvanceTotal: number;
};

const isoDate = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const SCHEDULE_METHOD: FiscalScheduleMethod = "historical";
const SCHEDULE_CONFIDENCE: FiscalScheduleConfidence = "estimated";
const SCHEDULE_ASSUMPTIONS: FiscalScheduleAssumptions = {
  configMode: "current_config_reapplied",
  paymentTrackingMode: "local_non_authoritative",
};
const MIN_SUBSTITUTE_TAX_ADVANCE = 51.65;
const DOUBLE_SUBSTITUTE_TAX_ADVANCE_THRESHOLD = 257.52;

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

  const substituteTaxAdvanceTotal = roundFiscalOutput(
    [...juneItems, ...novemberItems]
      .filter((item) => item.component.startsWith("imposta_"))
      .reduce((sum, item) => sum + item.amount, 0),
  );
  const inpsAdvanceTotal = roundFiscalOutput(
    [...juneItems, ...novemberItems]
      .filter((item) => item.component.startsWith("inps_"))
      .reduce((sum, item) => sum + item.amount, 0),
  );

  return {
    paymentYear,
    competenceYear,
    juneItems,
    novemberItems,
    substituteTaxAdvanceTotal,
    inpsAdvanceTotal,
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

export const buildDeadlines = (
  input: Parameters<typeof buildFiscalPaymentSchedule>[0],
) => buildFiscalPaymentSchedule(input).deadlines;
