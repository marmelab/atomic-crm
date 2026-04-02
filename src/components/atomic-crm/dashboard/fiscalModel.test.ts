import { afterEach, describe, expect, it, vi } from "vitest";

import { buildFiscalDeadlineKey } from "./buildFiscalDeadlineKey";
import {
  buildAdvancePlanFromEstimate,
  buildFiscalPaymentSchedule,
} from "./fiscalDeadlines";
import { buildFiscalModel } from "./fiscalModel";
import type {
  Client,
  Expense,
  FiscalConfig,
  Payment,
  Project,
  Quote,
  Service,
} from "../types";

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

const baseClient = (overrides: Partial<Client> = {}): Client => ({
  id: 1,
  name: "Cliente Test",
  client_type: "azienda_locale",
  tags: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const baseProject = (overrides: Partial<Project> = {}): Project => ({
  id: 1,
  client_id: 1,
  name: "Progetto Test",
  category: "produzione_tv",
  status: "in_corso",
  all_day: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const baseService = (overrides: Partial<Service> = {}): Service => ({
  id: 1,
  project_id: 1,
  service_date: "2026-01-10T10:00:00.000Z",
  all_day: false,
  is_taxable: true,
  service_type: "riprese",
  fee_shooting: 0,
  fee_editing: 0,
  fee_other: 0,
  discount: 0,
  km_distance: 0,
  km_rate: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const basePayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: 1,
  client_id: 1,
  project_id: 1,
  payment_date: "2026-01-15T00:00:00.000Z",
  payment_type: "saldo",
  amount: 0,
  status: "ricevuto",
  created_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const baseExpense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 1,
  expense_date: "2026-01-15T00:00:00.000Z",
  expense_type: "acquisto_materiale",
  amount: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
});

describe("buildFiscalModel — cash basis", () => {
  it("calculates fiscal base from received payments, not services (cash basis)", () => {
    const clients: Client[] = [
      baseClient({ id: 1, name: "Cliente A" }),
      baseClient({ id: 2, name: "Cliente B" }),
    ];
    const projects: Project[] = [
      baseProject({ id: 1, client_id: 1, name: "Progetto A" }),
      baseProject({ id: 2, client_id: 2, name: "Progetto B" }),
    ];
    // Services exist (competence) but fiscal base must come from payments (cash)
    const services: Service[] = [
      baseService({
        id: 1,
        project_id: 1,
        fee_shooting: 1000,
        is_taxable: true,
      }),
      baseService({
        id: 2,
        project_id: 2,
        fee_shooting: 2000,
        is_taxable: true,
      }),
    ];
    // Only 1500 was actually received in 2026 (cash basis)
    const payments: Payment[] = [
      basePayment({
        id: 1,
        client_id: 1,
        project_id: 1,
        amount: 500,
        status: "ricevuto",
        payment_date: "2026-02-01T00:00:00.000Z",
      }),
      basePayment({
        id: 2,
        client_id: 2,
        project_id: 2,
        amount: 1000,
        status: "ricevuto",
        payment_date: "2026-03-01T00:00:00.000Z",
      }),
      // Pending payment should NOT count
      basePayment({
        id: 3,
        client_id: 1,
        project_id: 1,
        amount: 500,
        status: "in_attesa",
        payment_date: "2026-04-01T00:00:00.000Z",
      }),
    ];

    const model = buildFiscalModel({
      services,
      expenses: [] satisfies Expense[],
      payments,
      quotes: [] satisfies Quote[],
      projects,
      clients,
      fiscalConfig,
      year: 2026,
    });

    // Fiscal base = received payments only = 500 + 1000 = 1500
    expect(model.fiscalKpis.fatturatoLordoYtd).toBe(1500);
    // Reddito forfettario = 1500 × 78% = 1170
    expect(model.fiscalKpis.redditoLordoForfettario).toBe(1170);
    // Totale incassato = 1500 (non ci sono pagamenti non tassabili)
    expect(model.fiscalKpis.fatturatoTotaleYtd).toBe(1500);
    expect(model.fiscalKpis.fatturatoNonTassabileYtd).toBe(0);
  });

  it("uses payment_date year for fiscal attribution, not service_date", () => {
    const clients: Client[] = [baseClient({ id: 1 })];
    const projects: Project[] = [baseProject({ id: 1, client_id: 1 })];
    // Service delivered in 2025 (competence basis = 2025)
    const services: Service[] = [
      baseService({
        id: 1,
        project_id: 1,
        fee_shooting: 5000,
        service_date: "2025-12-20T10:00:00.000Z",
      }),
    ];
    // But payment received in 2026 (cash basis = 2026)
    const payments: Payment[] = [
      basePayment({
        id: 1,
        client_id: 1,
        project_id: 1,
        amount: 5000,
        status: "ricevuto",
        payment_date: "2026-01-10T00:00:00.000Z",
      }),
    ];

    const model2026 = buildFiscalModel({
      services,
      expenses: [],
      payments,
      quotes: [],
      projects,
      clients,
      fiscalConfig,
      year: 2026,
    });

    const model2025 = buildFiscalModel({
      services,
      expenses: [],
      payments,
      quotes: [],
      projects,
      clients,
      fiscalConfig,
      year: 2025,
    });

    // Cash received in 2026 → fiscal base 2026
    expect(model2026.fiscalKpis.fatturatoLordoYtd).toBe(5000);
    // Nothing received in 2025 → fiscal base 2025 = 0
    expect(model2025.fiscalKpis.fatturatoLordoYtd).toBe(0);
  });

  it("subtracts refunds from the fiscal base", () => {
    const clients: Client[] = [baseClient({ id: 1 })];
    const projects: Project[] = [baseProject({ id: 1, client_id: 1 })];

    const payments: Payment[] = [
      basePayment({
        id: 1,
        client_id: 1,
        project_id: 1,
        amount: 2000,
        status: "ricevuto",
        payment_type: "saldo",
        payment_date: "2026-02-01T00:00:00.000Z",
      }),
      basePayment({
        id: 2,
        client_id: 1,
        project_id: 1,
        amount: 300,
        status: "ricevuto",
        payment_type: "rimborso",
        payment_date: "2026-03-01T00:00:00.000Z",
      }),
    ];

    const model = buildFiscalModel({
      services: [],
      expenses: [],
      payments,
      quotes: [],
      projects,
      clients,
      fiscalConfig,
      year: 2026,
    });

    // 2000 received - 300 refund = 1700 net cash
    expect(model.fiscalKpis.fatturatoLordoYtd).toBe(1700);
    expect(model.fiscalKpis.fatturatoTotaleYtd).toBe(1700);
  });

  it("maps a taxable payment to the matched ATECO profile", () => {
    const model = buildFiscalModel({
      services: [],
      expenses: [],
      payments: [
        basePayment({
          id: 1,
          client_id: 1,
          project_id: 1,
          amount: 1000,
          status: "ricevuto",
          payment_date: "2026-02-01T00:00:00.000Z",
        }),
      ],
      quotes: [],
      projects: [
        baseProject({ id: 1, client_id: 1, category: "produzione_tv" }),
      ],
      clients: [baseClient({ id: 1 })],
      fiscalConfig,
      year: 2026,
    });

    expect(model.fiscalKpis.fatturatoLordoYtd).toBe(1000);
    expect(model.fiscalKpis.fatturatoNonTassabileYtd).toBe(0);
    expect(model.fiscalKpis.unmappedCashRevenue).toBe(0);
    expect(
      model.atecoBreakdown.find((row) => row.atecoCode === "731102"),
    ).toMatchObject({
      fatturato: 1000,
      redditoForfettario: 780,
    });
  });

  it("excludes non-taxable payments via taxabilityDefaults config", () => {
    const configWithDefaults = makeFiscalConfig({
      taxabilityDefaults: {
        nonTaxableCategories: [],
        nonTaxableClientIds: ["2"],
      },
    });

    const clients: Client[] = [
      baseClient({ id: 1, name: "Taxable" }),
      baseClient({ id: 2, name: "Non-Taxable" }),
    ];
    const projects: Project[] = [
      baseProject({ id: 1, client_id: 1 }),
      baseProject({ id: 2, client_id: 2 }),
    ];

    const payments: Payment[] = [
      basePayment({
        id: 1,
        client_id: 1,
        project_id: 1,
        amount: 1000,
        status: "ricevuto",
        payment_date: "2026-02-01T00:00:00.000Z",
      }),
      basePayment({
        id: 2,
        client_id: 2,
        project_id: 2,
        amount: 500,
        status: "ricevuto",
        payment_date: "2026-02-15T00:00:00.000Z",
      }),
    ];

    const model = buildFiscalModel({
      services: [],
      expenses: [],
      payments,
      quotes: [],
      projects,
      clients,
      fiscalConfig: configWithDefaults,
      year: 2026,
    });

    // Total cash = 1000 + 500 = 1500
    expect(model.fiscalKpis.fatturatoTotaleYtd).toBe(1500);
    // Taxable cash = 1000 only (client 2 is non-taxable)
    expect(model.fiscalKpis.fatturatoLordoYtd).toBe(1000);
    expect(model.fiscalKpis.fatturatoNonTassabileYtd).toBe(500);
    expect(model.fiscalKpis.unmappedCashRevenue).toBe(0);
  });

  it("uses the explicit fallback ATECO profile for unmapped taxable cash", () => {
    const clients: Client[] = [baseClient({ id: 1 })];

    const payments: Payment[] = [
      basePayment({
        id: 1,
        client_id: 1,
        project_id: 1,
        amount: 800,
        status: "ricevuto",
        payment_date: "2026-01-20T00:00:00.000Z",
      }),
    ];

    const model = buildFiscalModel({
      services: [],
      expenses: [],
      payments,
      quotes: [],
      projects: [baseProject({ id: 1, client_id: 1, category: "wedding" })],
      clients,
      fiscalConfig: makeFiscalConfig({
        defaultTaxProfileAtecoCode: "621000",
      }),
      year: 2026,
    });

    expect(model.fiscalKpis.fatturatoLordoYtd).toBe(800);
    expect(model.fiscalKpis.unmappedCashRevenue).toBe(0);
    expect(model.fiscalKpis.redditoLordoForfettario).toBe(536); // 800 × 67%
    expect(
      model.atecoBreakdown.find((row) => row.atecoCode === "621000")?.fatturato,
    ).toBe(800);
  });

  it("keeps taxable cash unmapped and raises a warning when the configured fallback is invalid", () => {
    const model = buildFiscalModel({
      services: [],
      expenses: [],
      payments: [
        basePayment({
          id: 1,
          client_id: 1,
          project_id: null,
          amount: 700,
          status: "ricevuto",
          payment_date: "2026-04-01T00:00:00.000Z",
        }),
      ],
      quotes: [],
      projects: [],
      clients: [baseClient({ id: 1 })],
      fiscalConfig: makeFiscalConfig({
        defaultTaxProfileAtecoCode: "999999",
      }),
      year: 2026,
    });

    expect(model.fiscalKpis.fatturatoLordoYtd).toBe(0);
    expect(model.fiscalKpis.unmappedCashRevenue).toBe(700);
    expect(model.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "UNMAPPED_TAX_PROFILE",
          amount: 700,
        }),
      ]),
    );
  });

  it("keeps taxable cash unmapped and raises a warning when the fallback is missing", () => {
    const model = buildFiscalModel({
      services: [],
      expenses: [],
      payments: [
        basePayment({
          id: 1,
          client_id: 1,
          project_id: null,
          amount: 450,
          status: "ricevuto",
          payment_date: "2026-05-01T00:00:00.000Z",
        }),
      ],
      quotes: [],
      projects: [],
      clients: [baseClient({ id: 1 })],
      fiscalConfig: makeFiscalConfig({
        defaultTaxProfileAtecoCode: "",
      }),
      year: 2026,
    });

    expect(model.fiscalKpis.fatturatoLordoYtd).toBe(0);
    expect(model.fiscalKpis.unmappedCashRevenue).toBe(450);
    expect(model.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "UNMAPPED_TAX_PROFILE",
          amount: 450,
        }),
      ]),
    );
  });

  it("keeps raw cash negative in refund-heavy years while fiscal outputs clamp to zero", () => {
    const model = buildFiscalModel({
      services: [],
      expenses: [],
      payments: [
        basePayment({
          id: 1,
          client_id: 1,
          project_id: 1,
          amount: 100,
          status: "ricevuto",
          payment_type: "saldo",
          payment_date: "2026-01-10T00:00:00.000Z",
        }),
        basePayment({
          id: 2,
          client_id: 1,
          project_id: 1,
          amount: 300,
          status: "ricevuto",
          payment_type: "rimborso",
          payment_date: "2026-01-20T00:00:00.000Z",
        }),
      ],
      quotes: [],
      projects: [baseProject({ id: 1, client_id: 1 })],
      clients: [baseClient({ id: 1 })],
      fiscalConfig,
      year: 2026,
    });

    expect(model.fiscalKpis.fatturatoLordoYtd).toBe(-200);
    expect(model.fiscalKpis.fatturatoTotaleYtd).toBe(-200);
    expect(model.fiscalKpis.redditoLordoForfettario).toBe(0);
    expect(model.fiscalKpis.stimaInpsAnnuale).toBe(0);
    expect(model.fiscalKpis.stimaImpostaAnnuale).toBe(0);
  });

  it("keeps operational margins service-based while fiscal is cash-based", () => {
    const clients: Client[] = [
      baseClient({ id: 1, name: "Cliente A" }),
      baseClient({ id: 2, name: "Cliente B" }),
      baseClient({ id: 3, name: "Cliente C" }),
      baseClient({ id: 4, name: "Cliente D" }),
    ];
    const projects: Project[] = [
      baseProject({ id: 1, client_id: 1, name: "Progetto A" }),
      baseProject({ id: 2, client_id: 2, name: "Progetto B" }),
      baseProject({ id: 3, client_id: 3, name: "Progetto C" }),
      baseProject({ id: 4, client_id: 4, name: "Progetto D" }),
    ];
    const services: Service[] = [
      baseService({ id: 1, project_id: 1, fee_shooting: 400 }),
      baseService({ id: 2, project_id: 2, fee_shooting: 300 }),
      baseService({ id: 3, project_id: 3, fee_shooting: 200 }),
      baseService({ id: 4, project_id: 4, fee_shooting: 100 }),
    ];

    // Only partial payments received
    const payments: Payment[] = [
      basePayment({
        id: 1,
        client_id: 1,
        project_id: 1,
        amount: 400,
        status: "ricevuto",
        payment_date: "2026-02-01T00:00:00.000Z",
      }),
      basePayment({
        id: 2,
        client_id: 2,
        project_id: 2,
        amount: 200,
        status: "ricevuto",
        payment_date: "2026-02-15T00:00:00.000Z",
      }),
    ];

    const model = buildFiscalModel({
      services,
      expenses: [] satisfies Expense[],
      payments,
      quotes: [] satisfies Quote[],
      projects,
      clients,
      fiscalConfig,
      year: 2026,
    });

    // Fiscal base = cash received = 400 + 200 = 600
    expect(model.fiscalKpis.fatturatoLordoYtd).toBe(600);
    expect(model.fiscalKpis.redditoLordoForfettario).toBe(468); // 600 × 78%

    // Operational margins still use services (competence)
    // Total service revenue = 400+300+200+100 = 1000
    expect(model.businessHealth.marginPerCategory).toEqual([
      {
        category: "produzione_tv",
        label: "Produzione TV",
        margin: 100,
        revenue: 1000,
        expenses: 0,
      },
    ]);

    // Client concentration from services: top 3 = 400+300+200=900, total=1000
    expect(model.businessHealth.clientConcentration).toBeCloseTo(90, 5);
  });

  it("uses the Europe/Rome business year when year is omitted and dates cross UTC midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T23:30:00.000Z"));

    const model = buildFiscalModel({
      services: [
        baseService({
          id: 1,
          fee_shooting: 500,
          service_date: "2026-12-31T23:00:00.000Z",
        }),
      ],
      expenses: [
        baseExpense({
          id: 1,
          amount: 50,
          expense_date: "2026-12-31T23:00:00.000Z",
        }),
      ],
      payments: [
        basePayment({
          id: 1,
          amount: 1000,
          status: "ricevuto",
          payment_date: "2026-12-31T23:00:00.000Z",
        }),
      ],
      quotes: [],
      projects: [baseProject()],
      clients: [baseClient()],
      fiscalConfig,
    });

    expect(model.fiscalKpis.monthsOfData).toBe(1);
    expect(model.fiscalKpis.fatturatoLordoYtd).toBe(1000);
    expect(model.businessHealth.marginPerCategory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "produzione_tv",
          revenue: 500,
          expenses: 0,
        }),
        expect.objectContaining({
          category: "__general",
          revenue: 0,
          expenses: 50,
        }),
      ]),
    );
  });

  it("attributes payment_date to the correct business year across the UTC year boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-01T00:30:00.000Z"));

    const model = buildFiscalModel({
      services: [],
      expenses: [],
      payments: [
        basePayment({
          id: 1,
          client_id: 1,
          project_id: 1,
          amount: 1000,
          status: "ricevuto",
          payment_date: "2026-12-31T23:30:00.000Z",
        }),
      ],
      quotes: [],
      projects: [baseProject({ id: 1, client_id: 1 })],
      clients: [baseClient({ id: 1 })],
      fiscalConfig,
    });

    expect(model.fiscalKpis.taxYear).toBe(2027);
    expect(model.fiscalKpis.fatturatoLordoYtd).toBe(1000);
    expect(model.fiscalKpis.fatturatoTotaleYtd).toBe(1000);
    expect(model.fiscalKpis.fatturatoTotaleYtd).toBe(
      model.fiscalKpis.fatturatoLordoYtd +
        model.fiscalKpis.fatturatoNonTassabileYtd +
        model.fiscalKpis.unmappedCashRevenue,
    );
  });
});

describe("fiscal payment schedule", () => {
  it("first year has no June or November high-priority schedule", () => {
    const schedule = buildFiscalPaymentSchedule({
      paymentYear: 2023,
      basisEstimate: {
        taxYear: 2022,
        annualInpsEstimate: 800,
        annualSubstituteTaxEstimate: 500,
      },
      priorAdvancePlan: buildAdvancePlanFromEstimate({
        estimate: {
          taxYear: 2021,
          annualInpsEstimate: 700,
          annualSubstituteTaxEstimate: 400,
        },
      }),
      annoInizioAttivita: 2023,
      todayIso: "2023-01-15",
    });

    expect(
      schedule.deadlines.filter((deadline) => deadline.priority === "high"),
    ).toHaveLength(0);
    expect(schedule.supportingTaxYears).toEqual([2022, 2023]);
  });

  it("second year keeps saldo and ignores prior estimated advances", () => {
    const schedule = buildFiscalPaymentSchedule({
      paymentYear: 2024,
      basisEstimate: {
        taxYear: 2023,
        annualInpsEstimate: 100,
        annualSubstituteTaxEstimate: 100,
      },
      priorAdvancePlan: buildAdvancePlanFromEstimate({
        estimate: {
          taxYear: 2022,
          annualInpsEstimate: 1000,
          annualSubstituteTaxEstimate: 1000,
        },
      }),
      annoInizioAttivita: 2023,
      todayIso: "2024-01-15",
    });

    const juneDeadline = schedule.deadlines.find(
      (deadline) => deadline.label === "Saldo + 1° Acconto",
    );

    expect(juneDeadline?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          component: "imposta_saldo",
          amount: 100,
          competenceYear: 2023,
        }),
        expect.objectContaining({
          component: "inps_saldo",
          amount: 100,
          competenceYear: 2023,
        }),
      ]),
    );
    expect(schedule.supportingTaxYears).toEqual([2023, 2024]);
  });

  it("builds no/single/double substitute-tax advance branches exactly once", () => {
    const noAdvance = buildAdvancePlanFromEstimate({
      estimate: {
        taxYear: 2024,
        annualInpsEstimate: 100,
        annualSubstituteTaxEstimate: 40,
      },
    });
    const singleAdvance = buildAdvancePlanFromEstimate({
      estimate: {
        taxYear: 2024,
        annualInpsEstimate: 100,
        annualSubstituteTaxEstimate: 100,
      },
    });
    const doubleAdvance = buildAdvancePlanFromEstimate({
      estimate: {
        taxYear: 2024,
        annualInpsEstimate: 100,
        annualSubstituteTaxEstimate: 400,
      },
    });

    expect(
      [...noAdvance.juneItems, ...noAdvance.novemberItems].filter((item) =>
        item.component.startsWith("imposta_"),
      ),
    ).toHaveLength(0);
    expect(singleAdvance.novemberItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ component: "imposta_acconto_unico" }),
      ]),
    );
    expect(doubleAdvance.juneItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ component: "imposta_acconto_1" }),
      ]),
    );
    expect(doubleAdvance.novemberItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ component: "imposta_acconto_2" }),
      ]),
    );
  });

  it("zero-clamps residual saldo when prior estimated advances exceed the annual burden", () => {
    const schedule = buildFiscalPaymentSchedule({
      paymentYear: 2026,
      basisEstimate: {
        taxYear: 2025,
        annualInpsEstimate: 100,
        annualSubstituteTaxEstimate: 100,
      },
      priorAdvancePlan: {
        paymentYear: 2025,
        competenceYear: 2025,
        juneItems: [],
        novemberItems: [],
        substituteTaxAdvanceTotal: 150,
        inpsAdvanceTotal: 120,
      },
      annoInizioAttivita: 2023,
      todayIso: "2026-01-15",
    });

    const juneDeadline = schedule.deadlines.find(
      (deadline) => deadline.label === "Saldo + 1° Acconto",
    );

    expect(
      juneDeadline?.items.some((item) => item.component === "imposta_saldo"),
    ).toBe(false);
    expect(
      juneDeadline?.items.some((item) => item.component === "inps_saldo"),
    ).toBe(false);
  });

  it("keeps supporting tax years sorted and unique across normal schedules", () => {
    const schedule = buildFiscalPaymentSchedule({
      paymentYear: 2026,
      basisEstimate: {
        taxYear: 2025,
        annualInpsEstimate: 800,
        annualSubstituteTaxEstimate: 400,
      },
      priorAdvancePlan: buildAdvancePlanFromEstimate({
        estimate: {
          taxYear: 2024,
          annualInpsEstimate: 600,
          annualSubstituteTaxEstimate: 300,
        },
      }),
      annoInizioAttivita: 2023,
      todayIso: "2026-01-15",
    });

    expect(schedule.supportingTaxYears).toEqual([2025, 2026]);
  });

  it("keeps deadline ordering stable and fiscal keys independent from label/item order", () => {
    const schedule = buildFiscalPaymentSchedule({
      paymentYear: 2026,
      basisEstimate: {
        taxYear: 2025,
        annualInpsEstimate: 800,
        annualSubstituteTaxEstimate: 400,
      },
      priorAdvancePlan: buildAdvancePlanFromEstimate({
        estimate: {
          taxYear: 2024,
          annualInpsEstimate: 600,
          annualSubstituteTaxEstimate: 300,
        },
      }),
      annoInizioAttivita: 2023,
      todayIso: "2026-01-15",
    });

    expect(schedule.deadlines.map((deadline) => deadline.label)).toEqual([
      "Saldo + 1° Acconto",
      "2° Acconto",
      "Bollo Q1 (gen-mar)",
      "Bollo Q2 (apr-giu)",
      "Dichiarazione dei redditi",
      "Bollo Q3 (lug-set)",
      "Bollo Q4 (ott-dic)",
    ]);

    const juneDeadline = schedule.deadlines[0];
    const reorderedKey = buildFiscalDeadlineKey({
      paymentYear: juneDeadline.paymentYear,
      date: juneDeadline.date,
      method: juneDeadline.method,
      items: [...juneDeadline.items].reverse(),
    });

    expect(reorderedKey).toBe(buildFiscalDeadlineKey(juneDeadline));
  });
});
