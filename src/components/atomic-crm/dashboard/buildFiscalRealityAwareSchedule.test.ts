import { describe, it, expect } from "vitest";
import { buildFiscalRealityAwareSchedule } from "./buildFiscalRealityAwareSchedule";
import type { FiscalDeadline } from "./fiscalModelTypes";
import type {
  FiscalObligation,
  FiscalF24PaymentLineEnriched,
} from "./fiscalRealityTypes";

// --- Helpers to build test data ---

const baseAssumptions = {
  configMode: "current_config_reapplied" as const,
  paymentTrackingMode: "local_non_authoritative" as const,
};

const makeDeadline = (
  overrides: Partial<FiscalDeadline> & { date: string },
): FiscalDeadline => ({
  paymentYear: 2026,
  method: "historical",
  supportingTaxYears: [2025],
  confidence: "estimated",
  assumptions: baseAssumptions,
  label: "Saldo + 1° Acconto",
  items: [],
  totalAmount: 0,
  isPast: false,
  daysUntil: 60,
  priority: "high",
  ...overrides,
});

const makeObligation = (
  overrides: Partial<FiscalObligation> & {
    component: FiscalObligation["component"];
    due_date: string;
    amount: number;
  },
): FiscalObligation => ({
  id: "obl-1",
  declaration_id: "decl-1",
  source: "auto_generated",
  competence_year: 2025,
  payment_year: 2026,
  installment_number: null,
  installment_total: null,
  is_overridden: false,
  overridden_at: null,
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  user_id: "user-1",
  ...overrides,
});

const makePaymentLine = (
  overrides: Partial<FiscalF24PaymentLineEnriched> & {
    obligation_id: string;
    amount: number;
  },
): FiscalF24PaymentLineEnriched => ({
  id: "pl-1",
  submission_id: "sub-1",
  created_at: "2026-06-30T00:00:00Z",
  user_id: "user-1",
  submission_date: "2026-06-30",
  ...overrides,
});

const TODAY = "2026-04-02";

describe("buildFiscalRealityAwareSchedule", () => {
  it("returns estimated items when no obligations exist", () => {
    const deadlines: FiscalDeadline[] = [
      makeDeadline({
        date: "2026-06-30",
        items: [
          {
            description: "Saldo imposta sostitutiva",
            amount: 1000,
            competenceYear: 2025,
            component: "imposta_saldo",
          },
          {
            description: "Saldo INPS",
            amount: 500,
            competenceYear: 2025,
            component: "inps_saldo",
          },
        ],
        totalAmount: 1500,
      }),
    ];

    const result = buildFiscalRealityAwareSchedule({
      estimatedDeadlines: deadlines,
      obligations: [],
      enrichedPaymentLines: [],
      todayIso: TODAY,
    });

    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(2);
    expect(result[0].items[0].source).toBe("estimate");
    expect(result[0].items[0].status).toBe("estimated");
    expect(result[0].items[1].source).toBe("estimate");
    expect(result[0].items[1].status).toBe("estimated");
    expect(result[0].estimateComparison).toBeNull();
  });

  it("replaces estimated item with real obligation per merge key", () => {
    const deadlines: FiscalDeadline[] = [
      makeDeadline({
        date: "2026-06-30",
        items: [
          {
            description: "Saldo imposta sostitutiva",
            amount: 1000,
            competenceYear: 2025,
            component: "imposta_saldo",
          },
        ],
        totalAmount: 1000,
      }),
    ];

    const obligations: FiscalObligation[] = [
      makeObligation({
        id: "obl-imposta",
        component: "imposta_saldo",
        due_date: "2026-06-30",
        amount: 1200,
        competence_year: 2025,
      }),
    ];

    const result = buildFiscalRealityAwareSchedule({
      estimatedDeadlines: deadlines,
      obligations,
      enrichedPaymentLines: [],
      todayIso: TODAY,
    });

    expect(result).toHaveLength(1);
    expect(result[0].items[0].source).toBe("obligation");
    expect(result[0].items[0].status).toBe("due");
    expect(result[0].items[0].amount).toBe(1200);
    expect(result[0].items[0].remainingAmount).toBe(1200);
  });

  it("INPS remains estimated when only imposta has a real obligation", () => {
    const deadlines: FiscalDeadline[] = [
      makeDeadline({
        date: "2026-06-30",
        items: [
          {
            description: "Saldo imposta",
            amount: 1000,
            competenceYear: 2025,
            component: "imposta_saldo",
          },
          {
            description: "Saldo INPS",
            amount: 500,
            competenceYear: 2025,
            component: "inps_saldo",
          },
        ],
        totalAmount: 1500,
      }),
    ];

    const obligations: FiscalObligation[] = [
      makeObligation({
        id: "obl-imposta",
        component: "imposta_saldo",
        due_date: "2026-06-30",
        amount: 1100,
        competence_year: 2025,
      }),
    ];

    const result = buildFiscalRealityAwareSchedule({
      estimatedDeadlines: deadlines,
      obligations,
      enrichedPaymentLines: [],
      todayIso: TODAY,
    });

    expect(result).toHaveLength(1);
    const items = result[0].items;
    expect(items).toHaveLength(2);

    const imposta = items.find((i) => i.component === "imposta_saldo")!;
    const inps = items.find((i) => i.component === "inps_saldo")!;

    expect(imposta.source).toBe("obligation");
    expect(imposta.status).toBe("due");
    expect(imposta.amount).toBe(1100);

    expect(inps.source).toBe("estimate");
    expect(inps.status).toBe("estimated");
    expect(inps.amount).toBe(500);
  });

  it("shows estimateComparison with aggregate estimated amount when real data exists", () => {
    const deadlines: FiscalDeadline[] = [
      makeDeadline({
        date: "2026-06-30",
        items: [
          {
            description: "Saldo imposta",
            amount: 1000,
            competenceYear: 2025,
            component: "imposta_saldo",
          },
          {
            description: "Saldo INPS",
            amount: 500,
            competenceYear: 2025,
            component: "inps_saldo",
          },
        ],
        totalAmount: 1500,
      }),
    ];

    const obligations: FiscalObligation[] = [
      makeObligation({
        id: "obl-imposta",
        component: "imposta_saldo",
        due_date: "2026-06-30",
        amount: 1100,
        competence_year: 2025,
      }),
    ];

    const result = buildFiscalRealityAwareSchedule({
      estimatedDeadlines: deadlines,
      obligations,
      enrichedPaymentLines: [],
      todayIso: TODAY,
    });

    // estimateComparison = sum of ALL original estimated amounts for this deadline
    expect(result[0].estimateComparison).toBe(1500);
  });

  it("marks obligation as paid when payment lines cover full amount", () => {
    const deadlines: FiscalDeadline[] = [
      makeDeadline({
        date: "2026-06-30",
        items: [
          {
            description: "Saldo imposta",
            amount: 1000,
            competenceYear: 2025,
            component: "imposta_saldo",
          },
        ],
        totalAmount: 1000,
      }),
    ];

    const obligations: FiscalObligation[] = [
      makeObligation({
        id: "obl-1",
        component: "imposta_saldo",
        due_date: "2026-06-30",
        amount: 1000,
        competence_year: 2025,
      }),
    ];

    const paymentLines: FiscalF24PaymentLineEnriched[] = [
      makePaymentLine({
        obligation_id: "obl-1",
        amount: 1000,
        submission_date: "2026-06-28",
      }),
    ];

    const result = buildFiscalRealityAwareSchedule({
      estimatedDeadlines: deadlines,
      obligations,
      enrichedPaymentLines: paymentLines,
      todayIso: TODAY,
    });

    const item = result[0].items[0];
    expect(item.status).toBe("paid");
    expect(item.paidAmount).toBe(1000);
    expect(item.remainingAmount).toBe(0);
    expect(item.overpaidAmount).toBe(0);
  });

  it("marks obligation as partial when partially paid, with correct remainingAmount", () => {
    const obligations: FiscalObligation[] = [
      makeObligation({
        id: "obl-1",
        component: "imposta_saldo",
        due_date: "2026-06-30",
        amount: 1000,
        competence_year: 2025,
      }),
    ];

    const deadlines: FiscalDeadline[] = [
      makeDeadline({
        date: "2026-06-30",
        items: [
          {
            description: "Saldo imposta",
            amount: 900,
            competenceYear: 2025,
            component: "imposta_saldo",
          },
        ],
        totalAmount: 900,
      }),
    ];

    const paymentLines: FiscalF24PaymentLineEnriched[] = [
      makePaymentLine({
        obligation_id: "obl-1",
        amount: 600,
        submission_date: "2026-06-15",
      }),
    ];

    const result = buildFiscalRealityAwareSchedule({
      estimatedDeadlines: deadlines,
      obligations,
      enrichedPaymentLines: paymentLines,
      todayIso: TODAY,
    });

    const item = result[0].items[0];
    expect(item.status).toBe("partial");
    expect(item.amount).toBe(1000);
    expect(item.paidAmount).toBe(600);
    expect(item.remainingAmount).toBe(400);
    expect(item.overpaidAmount).toBe(0);
  });

  it("handles overpayment: status overpaid, remainingAmount 0, overpaidAmount > 0", () => {
    const obligations: FiscalObligation[] = [
      makeObligation({
        id: "obl-1",
        component: "imposta_saldo",
        due_date: "2026-06-30",
        amount: 1000,
        competence_year: 2025,
      }),
    ];

    const deadlines: FiscalDeadline[] = [
      makeDeadline({
        date: "2026-06-30",
        items: [
          {
            description: "Saldo imposta",
            amount: 1000,
            competenceYear: 2025,
            component: "imposta_saldo",
          },
        ],
        totalAmount: 1000,
      }),
    ];

    const paymentLines: FiscalF24PaymentLineEnriched[] = [
      makePaymentLine({
        obligation_id: "obl-1",
        amount: 1200,
        submission_date: "2026-06-28",
      }),
    ];

    const result = buildFiscalRealityAwareSchedule({
      estimatedDeadlines: deadlines,
      obligations,
      enrichedPaymentLines: paymentLines,
      todayIso: TODAY,
    });

    const item = result[0].items[0];
    expect(item.status).toBe("overpaid");
    expect(item.paidAmount).toBe(1200);
    expect(item.remainingAmount).toBe(0);
    expect(item.overpaidAmount).toBe(200);
  });

  it("real-only obligation with no estimated counterpart appears", () => {
    // No estimated deadlines at all for this date
    const deadlines: FiscalDeadline[] = [
      makeDeadline({
        date: "2026-06-30",
        items: [
          {
            description: "Saldo imposta",
            amount: 1000,
            competenceYear: 2025,
            component: "imposta_saldo",
          },
        ],
        totalAmount: 1000,
      }),
    ];

    // A manual bollo obligation on a date the estimator didn't predict
    const obligations: FiscalObligation[] = [
      makeObligation({
        id: "obl-bollo",
        component: "bollo",
        due_date: "2026-04-30",
        amount: 16,
        competence_year: 2025,
        source: "manual",
      }),
    ];

    const result = buildFiscalRealityAwareSchedule({
      estimatedDeadlines: deadlines,
      obligations,
      enrichedPaymentLines: [],
      todayIso: TODAY,
    });

    // Should have 2 deadlines: the estimated one on 06-30 + the real-only on 04-30
    expect(result.length).toBe(2);

    const bolloDeadline = result.find((d) => d.date === "2026-04-30");
    expect(bolloDeadline).toBeDefined();
    expect(bolloDeadline!.items).toHaveLength(1);
    expect(bolloDeadline!.items[0].component).toBe("bollo");
    expect(bolloDeadline!.items[0].source).toBe("obligation");
    expect(bolloDeadline!.items[0].status).toBe("due");
    expect(bolloDeadline!.items[0].amount).toBe(16);
    // bollo-only → low priority
    expect(bolloDeadline!.priority).toBe("low");
  });

  it("paidDate comes from enriched payment line submission_date", () => {
    const obligations: FiscalObligation[] = [
      makeObligation({
        id: "obl-1",
        component: "imposta_saldo",
        due_date: "2026-06-30",
        amount: 1000,
        competence_year: 2025,
      }),
    ];

    const deadlines: FiscalDeadline[] = [
      makeDeadline({
        date: "2026-06-30",
        items: [
          {
            description: "Saldo imposta",
            amount: 1000,
            competenceYear: 2025,
            component: "imposta_saldo",
          },
        ],
        totalAmount: 1000,
      }),
    ];

    const paymentLines: FiscalF24PaymentLineEnriched[] = [
      makePaymentLine({
        id: "pl-1",
        obligation_id: "obl-1",
        amount: 500,
        submission_date: "2026-06-15",
      }),
      makePaymentLine({
        id: "pl-2",
        obligation_id: "obl-1",
        amount: 500,
        submission_date: "2026-06-28",
      }),
    ];

    const result = buildFiscalRealityAwareSchedule({
      estimatedDeadlines: deadlines,
      obligations,
      enrichedPaymentLines: paymentLines,
      todayIso: TODAY,
    });

    // paidDate = last submission_date
    expect(result[0].items[0].paidDate).toBe("2026-06-28");
  });

  it("totalRemaining computed correctly across mixed items", () => {
    const deadlines: FiscalDeadline[] = [
      makeDeadline({
        date: "2026-06-30",
        items: [
          {
            description: "Saldo imposta",
            amount: 1000,
            competenceYear: 2025,
            component: "imposta_saldo",
          },
          {
            description: "Saldo INPS",
            amount: 500,
            competenceYear: 2025,
            component: "inps_saldo",
          },
        ],
        totalAmount: 1500,
      }),
    ];

    const obligations: FiscalObligation[] = [
      makeObligation({
        id: "obl-imposta",
        component: "imposta_saldo",
        due_date: "2026-06-30",
        amount: 1100,
        competence_year: 2025,
      }),
    ];

    const paymentLines: FiscalF24PaymentLineEnriched[] = [
      makePaymentLine({
        obligation_id: "obl-imposta",
        amount: 300,
        submission_date: "2026-06-15",
      }),
    ];

    const result = buildFiscalRealityAwareSchedule({
      estimatedDeadlines: deadlines,
      obligations,
      enrichedPaymentLines: paymentLines,
      todayIso: TODAY,
    });

    // imposta: amount=1100, paid=300, remaining=800
    // inps: amount=500, paid=0, remaining=500 (estimated)
    expect(result[0].totalAmount).toBe(1600);
    expect(result[0].totalPaid).toBe(300);
    expect(result[0].totalRemaining).toBe(1300);
    expect(result[0].totalOverpaid).toBe(0);
  });

  it("output sorted by priority then date", () => {
    const deadlines: FiscalDeadline[] = [
      makeDeadline({
        date: "2026-11-30",
        label: "2° Acconto Imposta",
        priority: "high",
        items: [
          {
            description: "2° Acconto",
            amount: 400,
            competenceYear: 2026,
            component: "imposta_acconto_2",
          },
        ],
        totalAmount: 400,
      }),
      makeDeadline({
        date: "2026-06-30",
        label: "Saldo + 1° Acconto",
        priority: "high",
        items: [
          {
            description: "Saldo imposta",
            amount: 1000,
            competenceYear: 2025,
            component: "imposta_saldo",
          },
        ],
        totalAmount: 1000,
      }),
      makeDeadline({
        date: "2026-02-28",
        label: "Bollo",
        priority: "low",
        items: [
          {
            description: "Bollo",
            amount: 16,
            competenceYear: 2025,
            component: "bollo",
          },
        ],
        totalAmount: 16,
      }),
    ];

    const result = buildFiscalRealityAwareSchedule({
      estimatedDeadlines: deadlines,
      obligations: [],
      enrichedPaymentLines: [],
      todayIso: TODAY,
    });

    // high priority first (sorted by date), then low priority
    expect(result[0].date).toBe("2026-06-30");
    expect(result[0].priority).toBe("high");
    expect(result[1].date).toBe("2026-11-30");
    expect(result[1].priority).toBe("high");
    expect(result[2].date).toBe("2026-02-28");
    expect(result[2].priority).toBe("low");
  });
});
