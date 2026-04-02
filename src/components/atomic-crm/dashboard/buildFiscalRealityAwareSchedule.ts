import type {
  FiscalDeadline,
  FiscalDeadlineComponent,
  FiscalScheduleItem,
} from "./fiscalModelTypes";
import type {
  FiscalObligation,
  FiscalF24PaymentLineEnriched,
  FiscalDeadlineView,
  FiscalDeadlineViewItem,
  FiscalDeadlineItemStatus,
} from "./fiscalRealityTypes";
import { buildFiscalObligationMergeKey } from "./buildFiscalDeadlineKey";
import { roundFiscalOutput } from "./roundFiscalOutput";
import { diffBusinessDays } from "@/lib/dateTimezone";

// ── Canonical component sort order ──────────────────────────────────

const COMPONENT_ORDER: FiscalDeadlineComponent[] = [
  "imposta_saldo",
  "inps_saldo",
  "imposta_acconto_1",
  "inps_acconto_1",
  "imposta_acconto_2",
  "imposta_acconto_unico",
  "inps_acconto_2",
  "bollo",
  "dichiarazione",
];

const componentIndex = (c: FiscalDeadlineComponent): number => {
  const idx = COMPONENT_ORDER.indexOf(c);
  return idx === -1 ? COMPONENT_ORDER.length : idx;
};

// ── Component label map ─────────────────────────────────────────────

const COMPONENT_LABELS: Record<FiscalDeadlineComponent, string> = {
  imposta_saldo: "Saldo Imposta",
  inps_saldo: "Saldo INPS",
  imposta_acconto_1: "1° Acconto Imposta",
  inps_acconto_1: "1° Acconto INPS",
  imposta_acconto_2: "2° Acconto Imposta",
  imposta_acconto_unico: "Acconto Unico Imposta",
  inps_acconto_2: "2° Acconto INPS",
  bollo: "Bollo",
  dichiarazione: "Dichiarazione",
};

const buildLabelFromComponents = (
  components: FiscalDeadlineComponent[],
): string => {
  const unique = [...new Set(components)].sort(
    (a, b) => componentIndex(a) - componentIndex(b),
  );
  return unique.map((c) => COMPONENT_LABELS[c]).join(" + ");
};

// ── Payment aggregation per obligation ──────────────────────────────

type PaymentSummary = {
  totalPaid: number;
  lastSubmissionDate: string | null;
};

const aggregatePayments = (
  lines: FiscalF24PaymentLineEnriched[],
): Map<string, PaymentSummary> => {
  const map = new Map<string, PaymentSummary>();
  for (const line of lines) {
    const existing = map.get(line.obligation_id);
    if (existing) {
      existing.totalPaid = roundFiscalOutput(existing.totalPaid + line.amount);
      if (
        !existing.lastSubmissionDate ||
        line.submission_date > existing.lastSubmissionDate
      ) {
        existing.lastSubmissionDate = line.submission_date;
      }
    } else {
      map.set(line.obligation_id, {
        totalPaid: line.amount,
        lastSubmissionDate: line.submission_date,
      });
    }
  }
  return map;
};

// ── Status derivation ───────────────────────────────────────────────

const deriveStatus = (
  amount: number,
  paidAmount: number,
): FiscalDeadlineItemStatus => {
  if (paidAmount <= 0) return "due";
  if (paidAmount > amount) return "overpaid";
  if (paidAmount >= amount) return "paid";
  return "partial";
};

// ── Build item from obligation ──────────────────────────────────────

const buildObligationItem = (
  obligation: FiscalObligation,
  payments: PaymentSummary | undefined,
): FiscalDeadlineViewItem => {
  const paidAmount = payments?.totalPaid ?? 0;
  const remaining = Math.max(
    0,
    roundFiscalOutput(obligation.amount - paidAmount),
  );
  const overpaid = Math.max(
    0,
    roundFiscalOutput(paidAmount - obligation.amount),
  );
  const status = deriveStatus(obligation.amount, paidAmount);

  return {
    component: obligation.component,
    competenceYear: obligation.competence_year,
    amount: obligation.amount,
    source: "obligation",
    paidAmount,
    paidDate: payments?.lastSubmissionDate ?? null,
    remainingAmount: remaining,
    overpaidAmount: overpaid,
    status,
  };
};

// ── Build item from estimate ────────────────────────────────────────

const buildEstimateItem = (
  item: FiscalScheduleItem,
): FiscalDeadlineViewItem => ({
  component: item.component,
  competenceYear: item.competenceYear ?? 0,
  amount: item.amount,
  source: "estimate",
  paidAmount: 0,
  paidDate: null,
  remainingAmount: item.amount,
  overpaidAmount: 0,
  status: "estimated",
});

// ── Main function ───────────────────────────────────────────────────

export const buildFiscalRealityAwareSchedule = ({
  estimatedDeadlines,
  obligations,
  enrichedPaymentLines,
  todayIso,
}: {
  estimatedDeadlines: FiscalDeadline[];
  obligations: FiscalObligation[];
  enrichedPaymentLines: FiscalF24PaymentLineEnriched[];
  todayIso: string;
}): FiscalDeadlineView[] => {
  // Step 1: Index obligations by merge key
  const obligationByKey = new Map<string, FiscalObligation>();
  for (const obl of obligations) {
    const key = buildFiscalObligationMergeKey({
      component: obl.component,
      competenceYear: obl.competence_year,
      dueDate: obl.due_date,
    });
    obligationByKey.set(key, obl);
  }

  // Step 2: Aggregate payment lines by obligation_id
  const paymentsByObligation = aggregatePayments(enrichedPaymentLines);

  // Step 3: Track consumed merge keys
  const consumedKeys = new Set<string>();

  // Step 4: Phase A — process estimated deadlines
  const deadlineViews: FiscalDeadlineView[] = [];

  for (const deadline of estimatedDeadlines) {
    const items: FiscalDeadlineViewItem[] = [];
    let hasRealObligation = false;

    for (const estItem of deadline.items) {
      const competenceYear = estItem.competenceYear ?? 0;
      const mergeKey = buildFiscalObligationMergeKey({
        component: estItem.component,
        competenceYear,
        dueDate: deadline.date,
      });

      const matchedObligation = obligationByKey.get(mergeKey);
      if (matchedObligation) {
        consumedKeys.add(mergeKey);
        hasRealObligation = true;
        items.push(
          buildObligationItem(
            matchedObligation,
            paymentsByObligation.get(matchedObligation.id),
          ),
        );
      } else {
        items.push(buildEstimateItem(estItem));
      }
    }

    // Sort items by canonical component order
    items.sort(
      (a, b) => componentIndex(a.component) - componentIndex(b.component),
    );

    const totalAmount = roundFiscalOutput(
      items.reduce((sum, i) => sum + i.amount, 0),
    );
    const totalPaid = roundFiscalOutput(
      items.reduce((sum, i) => sum + i.paidAmount, 0),
    );
    const totalRemaining = roundFiscalOutput(
      items.reduce((sum, i) => sum + i.remainingAmount, 0),
    );
    const totalOverpaid = roundFiscalOutput(
      items.reduce((sum, i) => sum + i.overpaidAmount, 0),
    );

    // estimateComparison = sum of ALL original estimated amounts when real data exists
    const estimateComparison = hasRealObligation
      ? roundFiscalOutput(deadline.items.reduce((sum, i) => sum + i.amount, 0))
      : null;

    const daysUntil = diffBusinessDays(todayIso, deadline.date) ?? 0;

    deadlineViews.push({
      date: deadline.date,
      label: deadline.label,
      paymentYear: deadline.paymentYear,
      priority: deadline.priority,
      isPast: daysUntil < 0,
      daysUntil,
      items,
      totalAmount,
      totalPaid,
      totalRemaining,
      totalOverpaid,
      estimateComparison,
    });
  }

  // Step 5: Phase B — add remaining real obligations (unconsumed)
  const unconsumedByDate = new Map<string, FiscalObligation[]>();
  for (const obl of obligations) {
    const key = buildFiscalObligationMergeKey({
      component: obl.component,
      competenceYear: obl.competence_year,
      dueDate: obl.due_date,
    });
    if (!consumedKeys.has(key)) {
      const existing = unconsumedByDate.get(obl.due_date) ?? [];
      existing.push(obl);
      unconsumedByDate.set(obl.due_date, existing);
    }
  }

  for (const [dueDate, obls] of unconsumedByDate) {
    const items: FiscalDeadlineViewItem[] = obls.map((obl) =>
      buildObligationItem(obl, paymentsByObligation.get(obl.id)),
    );

    // Sort items by canonical component order
    items.sort(
      (a, b) => componentIndex(a.component) - componentIndex(b.component),
    );

    const allBollo = obls.every((o) => o.component === "bollo");
    const priority: "high" | "low" = allBollo ? "low" : "high";

    const label = buildLabelFromComponents(obls.map((o) => o.component));
    const paymentYear = obls[0].payment_year;

    const totalAmount = roundFiscalOutput(
      items.reduce((sum, i) => sum + i.amount, 0),
    );
    const totalPaid = roundFiscalOutput(
      items.reduce((sum, i) => sum + i.paidAmount, 0),
    );
    const totalRemaining = roundFiscalOutput(
      items.reduce((sum, i) => sum + i.remainingAmount, 0),
    );
    const totalOverpaid = roundFiscalOutput(
      items.reduce((sum, i) => sum + i.overpaidAmount, 0),
    );

    const daysUntil = diffBusinessDays(todayIso, dueDate) ?? 0;

    deadlineViews.push({
      date: dueDate,
      label,
      paymentYear,
      priority,
      isPast: daysUntil < 0,
      daysUntil,
      items,
      totalAmount,
      totalPaid,
      totalRemaining,
      totalOverpaid,
      estimateComparison: null,
    });
  }

  // Step 6: Sort — high priority first, then by date
  deadlineViews.sort((a, b) => {
    const priorityOrder = a.priority === "high" ? 0 : 1;
    const priorityOrderB = b.priority === "high" ? 0 : 1;
    if (priorityOrder !== priorityOrderB) return priorityOrder - priorityOrderB;
    return a.date.localeCompare(b.date);
  });

  return deadlineViews;
};
