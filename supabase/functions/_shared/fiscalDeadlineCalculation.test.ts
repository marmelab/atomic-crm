import { describe, expect, it } from "vitest";

import {
  buildDeadlineNotificationMessage,
  buildFiscalDeadlineKey,
  buildFiscalReminderComputation,
  buildFiscalYearEstimate,
  buildTaskPayloads,
  type FiscalConfig,
  type PaymentRow,
  type ProjectRow,
} from "./fiscalDeadlineCalculation.ts";

const fiscalConfig: FiscalConfig = {
  taxProfiles: [
    {
      atecoCode: "731102",
      description: "Marketing e servizi pubblicitari",
      coefficienteReddititivita: 78,
      linkedCategories: ["produzione_tv"],
    },
    {
      atecoCode: "621000",
      description: "Produzione software e consulenza IT",
      coefficienteReddititivita: 67,
      linkedCategories: ["sviluppo_web"],
    },
  ],
  defaultTaxProfileAtecoCode: "731102",
  aliquotaINPS: 26.07,
  tettoFatturato: 85000,
  annoInizioAttivita: 2023,
  taxabilityDefaults: {
    nonTaxableCategories: [],
    nonTaxableClientIds: [],
  },
};

const makeFiscalConfig = (
  overrides: Partial<FiscalConfig> = {},
): FiscalConfig => ({
  ...fiscalConfig,
  ...overrides,
  taxProfiles: overrides.taxProfiles ?? fiscalConfig.taxProfiles,
  taxabilityDefaults: {
    ...fiscalConfig.taxabilityDefaults,
    ...overrides.taxabilityDefaults,
  },
});

const baseProject = (overrides: Partial<ProjectRow> = {}): ProjectRow => ({
  id: "project-1",
  category: "produzione_tv",
  ...overrides,
});

const basePayment = (overrides: Partial<PaymentRow> = {}): PaymentRow => ({
  amount: 0,
  payment_date: "2026-01-15T00:00:00.000Z",
  status: "ricevuto",
  project_id: "project-1",
  client_id: "client-1",
  payment_type: "saldo",
  ...overrides,
});

describe("buildFiscalYearEstimate", () => {
  it("mappedTaxable_basic", () => {
    const estimate = buildFiscalYearEstimate({
      payments: [
        basePayment({
          amount: 1000,
          payment_date: "2026-02-01T00:00:00.000Z",
        }),
      ],
      projects: [baseProject()],
      fiscalConfig,
      taxYear: 2026,
    });

    expect(estimate.fiscalKpis).toMatchObject({
      fatturatoLordoYtd: 1000,
      fatturatoTotaleYtd: 1000,
      fatturatoNonTassabileYtd: 0,
      unmappedCashRevenue: 0,
      redditoLordoForfettario: 780,
      stimaInpsAnnuale: 203.35,
      stimaImpostaAnnuale: 28.83,
    });
    expect(estimate.warnings).toEqual([]);
  });

  it("nonTaxable_excluded", () => {
    const estimate = buildFiscalYearEstimate({
      payments: [
        basePayment({
          amount: 1000,
          client_id: "client-1",
          payment_date: "2026-02-01T00:00:00.000Z",
        }),
        basePayment({
          amount: 500,
          client_id: "client-2",
          project_id: "project-2",
          payment_date: "2026-02-15T00:00:00.000Z",
        }),
      ],
      projects: [
        baseProject({ id: "project-1" }),
        baseProject({ id: "project-2" }),
      ],
      fiscalConfig: makeFiscalConfig({
        taxabilityDefaults: {
          nonTaxableCategories: [],
          nonTaxableClientIds: ["client-2"],
        },
      }),
      taxYear: 2026,
    });

    expect(estimate.fiscalKpis).toMatchObject({
      fatturatoLordoYtd: 1000,
      fatturatoTotaleYtd: 1500,
      fatturatoNonTassabileYtd: 500,
      unmappedCashRevenue: 0,
    });
  });

  it("fallback profile success", () => {
    const estimate = buildFiscalYearEstimate({
      payments: [
        basePayment({
          amount: 800,
          project_id: "project-1",
          payment_date: "2026-01-20T00:00:00.000Z",
        }),
      ],
      projects: [baseProject({ id: "project-1", category: "wedding" })],
      fiscalConfig: makeFiscalConfig({
        defaultTaxProfileAtecoCode: "621000",
      }),
      taxYear: 2026,
    });

    expect(estimate.fiscalKpis).toMatchObject({
      fatturatoLordoYtd: 800,
      unmappedCashRevenue: 0,
      redditoLordoForfettario: 536,
    });
    expect(estimate.warnings).toEqual([]);
  });

  it("unmapped_missingFallback", () => {
    const estimate = buildFiscalYearEstimate({
      payments: [
        basePayment({
          amount: 450,
          project_id: null,
          payment_date: "2026-05-01T00:00:00.000Z",
        }),
      ],
      projects: [],
      fiscalConfig: makeFiscalConfig({
        defaultTaxProfileAtecoCode: "",
      }),
      taxYear: 2026,
    });

    expect(estimate.fiscalKpis).toMatchObject({
      fatturatoLordoYtd: 0,
      unmappedCashRevenue: 450,
    });
    expect(estimate.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "UNMAPPED_TAX_PROFILE",
          amount: 450,
          taxYear: 2026,
        }),
      ]),
    );
  });

  it("invalidFallbackConfig_unmappedWarning", () => {
    const estimate = buildFiscalYearEstimate({
      payments: [
        basePayment({
          amount: 700,
          project_id: null,
          payment_date: "2026-04-01T00:00:00.000Z",
        }),
      ],
      projects: [],
      fiscalConfig: makeFiscalConfig({
        defaultTaxProfileAtecoCode: "999999",
      }),
      taxYear: 2026,
    });

    expect(estimate.fiscalKpis).toMatchObject({
      fatturatoLordoYtd: 0,
      unmappedCashRevenue: 700,
    });
    expect(estimate.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "UNMAPPED_TAX_PROFILE",
          amount: 700,
          taxYear: 2026,
        }),
      ]),
    );
  });

  it("refundHeavy_negativeRawCash", () => {
    const estimate = buildFiscalYearEstimate({
      payments: [
        basePayment({
          amount: 100,
          payment_type: "saldo",
          payment_date: "2026-01-10T00:00:00.000Z",
        }),
        basePayment({
          amount: 300,
          payment_type: "rimborso",
          payment_date: "2026-01-20T00:00:00.000Z",
        }),
      ],
      projects: [baseProject()],
      fiscalConfig,
      taxYear: 2026,
    });

    expect(estimate.fiscalKpis).toMatchObject({
      fatturatoLordoYtd: -200,
      fatturatoTotaleYtd: -200,
      redditoLordoForfettario: 0,
      stimaInpsAnnuale: 0,
      stimaImpostaAnnuale: 0,
    });
  });

  it("classifies payment year in Europe/Rome at UTC year boundary", () => {
    const estimate = buildFiscalYearEstimate({
      payments: [
        basePayment({
          amount: 1000,
          payment_date: "2026-12-31T23:30:00.000Z",
        }),
      ],
      projects: [baseProject()],
      fiscalConfig,
      taxYear: 2027,
    });

    expect(estimate.fiscalKpis.stimaInpsAnnuale).toBe(203.35);
    expect(estimate.fiscalKpis.stimaImpostaAnnuale).toBe(28.83);
  });
});

describe("buildFiscalReminderComputation", () => {
  it("schedule_firstYear", () => {
    const computation = buildFiscalReminderComputation({
      config: fiscalConfig,
      payments: [],
      projects: [],
      paymentYear: 2023,
      todayIso: "2023-01-15",
    });

    expect(computation.schedule.isFirstYear).toBe(true);
    expect(
      computation.schedule.deadlines.filter(
        (deadline) => deadline.priority === "high",
      ),
    ).toHaveLength(0);
    expect(computation.schedule.supportingTaxYears).toEqual([2022, 2023]);
  });

  it("schedule_secondYear_singleAdvance", () => {
    const computation = buildFiscalReminderComputation({
      config: fiscalConfig,
      payments: [
        basePayment({
          amount: 2000,
          payment_date: "2023-02-01T00:00:00.000Z",
        }),
      ],
      projects: [baseProject()],
      paymentYear: 2024,
      todayIso: "2024-01-15",
    });

    const juneDeadline = computation.schedule.deadlines.find(
      (deadline) => deadline.date === "2024-06-30",
    );
    const novemberDeadline = computation.schedule.deadlines.find(
      (deadline) => deadline.date === "2024-11-30",
    );

    expect(computation.schedule.isFirstYear).toBe(false);
    expect(juneDeadline?.items).toEqual([
      expect.objectContaining({
        component: "imposta_saldo",
        amount: 57.67,
        competenceYear: 2023,
      }),
      expect.objectContaining({
        component: "inps_saldo",
        amount: 406.69,
        competenceYear: 2023,
      }),
      expect.objectContaining({
        component: "inps_acconto_1",
        amount: 162.68,
        competenceYear: 2024,
      }),
    ]);
    expect(novemberDeadline?.items).toEqual([
      expect.objectContaining({
        component: "imposta_acconto_unico",
        amount: 57.67,
        competenceYear: 2024,
      }),
      expect.objectContaining({
        component: "inps_acconto_2",
        amount: 162.68,
        competenceYear: 2024,
      }),
    ]);
  });

  it("schedule_doubleAdvance", () => {
    const computation = buildFiscalReminderComputation({
      config: fiscalConfig,
      payments: [
        basePayment({
          amount: 10000,
          payment_date: "2025-03-01T00:00:00.000Z",
        }),
      ],
      projects: [baseProject()],
      paymentYear: 2026,
      todayIso: "2026-01-15",
    });

    const juneDeadline = computation.schedule.deadlines.find(
      (deadline) => deadline.date === "2026-06-30",
    );
    const novemberDeadline = computation.schedule.deadlines.find(
      (deadline) => deadline.date === "2026-11-30",
    );

    expect(juneDeadline?.items.map((item) => item.component)).toEqual([
      "imposta_saldo",
      "inps_saldo",
      "imposta_acconto_1",
      "inps_acconto_1",
    ]);
    expect(novemberDeadline?.items.map((item) => item.component)).toEqual([
      "imposta_acconto_2",
      "inps_acconto_2",
    ]);
  });

  it("zero-clamps residual saldo when prior advances exceed the annual estimate", () => {
    const computation = buildFiscalReminderComputation({
      config: fiscalConfig,
      payments: [
        basePayment({
          amount: 20000,
          payment_date: "2024-02-01T00:00:00.000Z",
        }),
        basePayment({
          amount: 2000,
          payment_date: "2025-02-01T00:00:00.000Z",
        }),
      ],
      projects: [baseProject()],
      paymentYear: 2026,
      todayIso: "2026-01-15",
    });

    const juneDeadline = computation.schedule.deadlines.find(
      (deadline) => deadline.date === "2026-06-30",
    );

    expect(juneDeadline?.items.map((item) => item.component)).toEqual([
      "inps_acconto_1",
    ]);
  });

  it("includes structured warnings with paymentYear for degraded estimates", () => {
    const computation = buildFiscalReminderComputation({
      config: makeFiscalConfig({
        defaultTaxProfileAtecoCode: "",
      }),
      payments: [
        basePayment({
          amount: 450,
          project_id: null,
          payment_date: "2026-05-01T00:00:00.000Z",
        }),
      ],
      projects: [],
      paymentYear: 2027,
      todayIso: "2027-01-15",
    });

    expect(computation.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "UNMAPPED_TAX_PROFILE",
          taxYear: 2026,
          amount: 450,
          paymentYear: 2027,
        }),
      ]),
    );
  });
});

describe("reminder outputs", () => {
  it("creates due_date at start of Europe/Rome business day", () => {
    const computation = buildFiscalReminderComputation({
      config: fiscalConfig,
      payments: [
        basePayment({
          amount: 2000,
          payment_date: "2023-02-01T00:00:00.000Z",
        }),
      ],
      projects: [baseProject()],
      paymentYear: 2024,
      todayIso: "2024-01-15",
    });

    const juneDeadline = computation.schedule.deadlines.find(
      (deadline) => deadline.date === "2024-06-30",
    );
    const payloads = buildTaskPayloads(juneDeadline ? [juneDeadline] : []);

    expect(payloads[0]?.due_date).toBe("2024-06-29T22:00:00.000Z");
    expect(payloads[0]?.type).toBe("f24");
    expect(payloads[0]?.text).toContain("(stimato)");
  });

  it("formats notification dates without runtime timezone drift", () => {
    const computation = buildFiscalReminderComputation({
      config: fiscalConfig,
      payments: [
        basePayment({
          amount: 2000,
          payment_date: "2023-02-01T00:00:00.000Z",
        }),
      ],
      projects: [baseProject()],
      paymentYear: 2024,
      todayIso: "2024-01-15",
    });

    const juneDeadline = computation.schedule.deadlines.find(
      (deadline) => deadline.date === "2024-06-30",
    );
    const message = buildDeadlineNotificationMessage(
      juneDeadline ? [juneDeadline] : [],
    );

    expect(message).toContain("Scadenze fiscali stimate in arrivo:");
    expect(message).toContain("30 giugno 2024");
    expect(message).toContain("Saldo + 1° Acconto");
  });

  it("builds stable deadline keys from invariant schedule data", () => {
    const computation = buildFiscalReminderComputation({
      config: fiscalConfig,
      payments: [
        basePayment({
          amount: 10000,
          payment_date: "2025-03-01T00:00:00.000Z",
        }),
      ],
      projects: [baseProject()],
      paymentYear: 2026,
      todayIso: "2026-01-15",
    });

    const juneDeadline = computation.schedule.deadlines.find(
      (deadline) => deadline.date === "2026-06-30",
    );
    const reorderedDeadline =
      juneDeadline == null
        ? null
        : {
            ...juneDeadline,
            items: [...juneDeadline.items].reverse(),
          };

    expect(juneDeadline).not.toBeNull();
    expect(reorderedDeadline).not.toBeNull();
    expect(buildFiscalDeadlineKey(juneDeadline!)).toBe(
      buildFiscalDeadlineKey(reorderedDeadline!),
    );
  });
});
