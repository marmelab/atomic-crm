import { afterEach, describe, expect, it, vi } from "vitest";

import { buildDashboardModel } from "./dashboardModel";
import type {
  Client,
  Expense,
  FiscalConfig,
  Payment,
  Project,
  Quote,
  Service,
} from "../types";

const baseClient = (overrides: Partial<Client> = {}): Client => ({
  id: 1,
  name: "Cliente Test",
  client_type: "azienda_locale",
  tags: [],
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

const baseProject = (overrides: Partial<Project> = {}): Project => ({
  id: 1,
  client_id: 1,
  name: "Progetto Test",
  category: "produzione_tv",
  status: "in_corso",
  all_day: false,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

const baseService = (overrides: Partial<Service> = {}): Service => ({
  id: 1,
  project_id: 1,
  service_date: "2025-01-10T10:00:00.000Z",
  all_day: false,
  service_type: "riprese",
  fee_shooting: 0,
  fee_editing: 0,
  fee_other: 0,
  discount: 0,
  km_distance: 0,
  km_rate: 0,
  created_at: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

const baseQuote = (overrides: Partial<Quote> = {}): Quote => ({
  id: 1,
  client_id: 1,
  service_type: "riprese",
  all_day: false,
  amount: 0,
  status: "preventivo_inviato",
  index: 0,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

const basePayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: 1,
  client_id: 1,
  amount: 0,
  payment_type: "saldo",
  status: "ricevuto",
  created_at: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

const baseExpense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 1,
  expense_date: "2025-01-15T00:00:00.000Z",
  expense_type: "acquisto_materiale",
  amount: 0,
  created_at: "2025-01-01T00:00:00.000Z",
  ...overrides,
});

const fiscalConfig: FiscalConfig = {
  taxProfiles: [
    {
      atecoCode: "59.11.00",
      description: "Produzione video",
      coefficienteReddititivita: 78,
      linkedCategories: ["produzione_tv", "spot"],
    },
  ],
  aliquotaINPS: 26,
  tettoFatturato: 85000,
  annoInizioAttivita: 2023,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("buildDashboardModel annual semantics", () => {
  it("reads the current year as year-to-date and excludes future services with the same net basis everywhere", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-28T09:00:00.000Z"));

    const clients: Client[] = [
      baseClient({ id: 1, name: "Cliente A" }),
      baseClient({ id: 2, name: "Cliente B" }),
    ];
    const projects: Project[] = [
      baseProject({ id: 1, client_id: 1, category: "produzione_tv" }),
      baseProject({ id: 2, client_id: 2, category: "spot" }),
    ];
    const services: Service[] = [
      baseService({
        id: 1,
        project_id: 1,
        service_date: "2026-01-10T10:00:00.000Z",
        fee_shooting: 1000,
        discount: 100,
        km_distance: 10,
        km_rate: 0.5,
      }),
      baseService({
        id: 2,
        project_id: 2,
        service_date: "2026-02-12T10:00:00.000Z",
        fee_shooting: 500,
      }),
      baseService({
        id: 3,
        project_id: 1,
        service_date: "2026-03-10T10:00:00.000Z",
        fee_shooting: 700,
        discount: 50,
      }),
    ];

    const model = buildDashboardModel({
      payments: [],
      quotes: [],
      services,
      projects,
      clients,
      expenses: [],
      year: 2026,
    });

    expect(model.isCurrentYear).toBe(true);
    expect(model.kpis.annualRevenue).toBe(1400);
    expect(model.kpis.monthlyRevenue).toBe(500);
    expect(model.revenueTrend).toHaveLength(2);
    expect(model.qualityFlags).toContain("partial_current_year");
    expect(model.qualityFlags).toContain("future_services_excluded");
    expect(model.meta.asOfDate).toBe("2026-02-28");
    expect(model.meta.operationsPeriodLabel).toBe("gen-feb 2026");
    expect(
      model.topClients.map((item) => [item.clientName, item.revenue]),
    ).toEqual([
      ["Cliente A", 900],
      ["Cliente B", 500],
    ]);
    expect(
      model.categoryBreakdown.map((item) => [item.category, item.revenue]),
    ).toEqual([
      ["produzione_tv", 900],
      ["spot", 500],
    ]);
  });

  it("filters fiscal conversion, weighted pipeline, and DSO on the selected year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T09:00:00.000Z"));

    const clients: Client[] = [baseClient({ id: 1, name: "Cliente A" })];
    const projects: Project[] = [baseProject({ id: 1, client_id: 1 })];
    const services: Service[] = [
      baseService({
        id: 1,
        service_date: "2025-01-10T10:00:00.000Z",
        fee_shooting: 1000,
      }),
      baseService({
        id: 2,
        service_date: "2026-01-10T10:00:00.000Z",
        fee_shooting: 5000,
      }),
    ];
    const quotes: Quote[] = [
      baseQuote({
        id: 1,
        status: "accettato",
        amount: 1000,
        created_at: "2025-01-05T00:00:00.000Z",
      }),
      baseQuote({
        id: 2,
        status: "preventivo_inviato",
        amount: 2000,
        created_at: "2025-02-10T00:00:00.000Z",
      }),
      baseQuote({
        id: 3,
        status: "preventivo_inviato",
        amount: 9999,
        created_at: "2026-02-10T00:00:00.000Z",
      }),
    ];
    const payments: Payment[] = [
      basePayment({
        id: 1,
        project_id: 1,
        amount: 1000,
        payment_date: "2025-03-01T00:00:00.000Z",
      }),
      basePayment({
        id: 2,
        project_id: 1,
        amount: 1000,
        payment_date: "2026-03-01T00:00:00.000Z",
      }),
    ];

    const model = buildDashboardModel({
      payments,
      quotes,
      services,
      projects,
      clients,
      expenses: [] satisfies Expense[],
      fiscalConfig,
      year: 2025,
    });

    expect(model.isCurrentYear).toBe(false);
    expect(model.meta.monthlyReferenceLabel).toBe("dic 25");
    expect(model.revenueTrend).toHaveLength(12);
    expect(model.fiscal?.businessHealth.quoteConversionRate).toBe(50);
    expect(model.fiscal?.businessHealth.weightedPipelineValue).toBe(1000);
    expect(model.fiscal?.businessHealth.dso).toBe(50);
  });

  it("exposes AI-safe drilldowns for pending payments and open quotes without forcing projects", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T09:00:00.000Z"));

    const clients: Client[] = [
      baseClient({ id: 1, name: "Cliente Wedding" }),
      baseClient({ id: 2, name: "Cliente TV" }),
    ];
    const projects: Project[] = [
      baseProject({ id: 1, client_id: 2, name: "Programma TV" }),
    ];
    const quotes: Quote[] = [
      baseQuote({
        id: 1,
        client_id: 1,
        project_id: null,
        description: "Pacchetto wedding",
        amount: 900,
        status: "preventivo_inviato",
        created_at: "2025-02-10T00:00:00.000Z",
        sent_date: "2025-02-11T00:00:00.000Z",
        quote_items: [
          {
            description: "Riprese",
            quantity: 1,
            unit_price: 600,
          },
          {
            description: "Montaggio",
            quantity: 1,
            unit_price: 300,
          },
        ],
      }),
      baseQuote({
        id: 2,
        client_id: 2,
        project_id: 1,
        description: "Servizio TV",
        amount: 1200,
        status: "in_trattativa",
        created_at: "2025-03-15T00:00:00.000Z",
        sent_date: "2025-03-16T00:00:00.000Z",
      }),
      baseQuote({
        id: 3,
        client_id: 2,
        project_id: 1,
        description: "Quote chiuso",
        amount: 500,
        status: "saldato",
        created_at: "2025-04-01T00:00:00.000Z",
      }),
    ];
    const payments: Payment[] = [
      basePayment({
        id: 1,
        client_id: 1,
        project_id: null,
        quote_id: 1,
        amount: 400,
        status: "in_attesa",
        payment_date: "2025-05-10T00:00:00.000Z",
      }),
      basePayment({
        id: 2,
        client_id: 2,
        project_id: 1,
        quote_id: 2,
        amount: 700,
        status: "scaduto",
        payment_date: "2025-04-10T00:00:00.000Z",
      }),
      basePayment({
        id: 3,
        client_id: 2,
        project_id: 1,
        amount: 200,
        status: "ricevuto",
        payment_date: "2025-06-10T00:00:00.000Z",
      }),
    ];

    const model = buildDashboardModel({
      payments,
      quotes,
      services: [],
      projects,
      clients,
      expenses: [],
      year: 2025,
    });

    expect(model.drilldowns.pendingPayments).toEqual([
      {
        paymentId: "2",
        clientId: "2",
        clientName: "Cliente TV",
        projectId: "1",
        projectName: "Programma TV",
        quoteId: "2",
        amount: 700,
        status: "scaduto",
        paymentDate: "2025-04-10T00:00:00.000Z",
      },
      {
        paymentId: "1",
        clientId: "1",
        clientName: "Cliente Wedding",
        projectId: undefined,
        projectName: undefined,
        quoteId: "1",
        amount: 400,
        status: "in_attesa",
        paymentDate: "2025-05-10T00:00:00.000Z",
      },
    ]);

    expect(model.drilldowns.openQuotes).toEqual([
      {
        quoteId: "2",
        clientId: "2",
        clientName: "Cliente TV",
        projectId: "1",
        projectName: "Programma TV",
        description: "Servizio TV",
        amount: 1200,
        status: "in_trattativa",
        statusLabel: "In trattativa",
        sentDate: "2025-03-16T00:00:00.000Z",
        hasProject: true,
        hasItemizedLines: false,
        quoteItemsCount: 0,
      },
      {
        quoteId: "1",
        clientId: "1",
        clientName: "Cliente Wedding",
        projectId: undefined,
        projectName: undefined,
        description: "Pacchetto wedding",
        amount: 900,
        status: "preventivo_inviato",
        statusLabel: "Preventivo inviato",
        sentDate: "2025-02-11T00:00:00.000Z",
        hasProject: false,
        hasItemizedLines: true,
        quoteItemsCount: 2,
      },
    ]);
  });

  it("aggregates expenses by type, excludes credits, and computes km reimbursement", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T09:00:00.000Z"));

    const model = buildDashboardModel({
      payments: [],
      quotes: [],
      services: [baseService({ fee_shooting: 2000 })],
      projects: [baseProject()],
      clients: [baseClient()],
      expenses: [
        baseExpense({
          id: 1,
          expense_type: "acquisto_materiale",
          amount: 150,
          expense_date: "2025-02-10T00:00:00.000Z",
        }),
        baseExpense({
          id: 2,
          expense_type: "acquisto_materiale",
          amount: 50,
          expense_date: "2025-03-10T00:00:00.000Z",
        }),
        baseExpense({
          id: 3,
          expense_type: "spostamento_km",
          km_distance: 100,
          km_rate: 0.19,
          expense_date: "2025-01-20T00:00:00.000Z",
        }),
        baseExpense({
          id: 4,
          expense_type: "credito_ricevuto",
          amount: 500,
          expense_date: "2025-04-01T00:00:00.000Z",
        }),
        baseExpense({
          id: 5,
          expense_type: "vitto_alloggio",
          amount: 80,
          expense_date: "2024-12-15T00:00:00.000Z",
        }),
      ],
      year: 2025,
    });

    expect(model.kpis.annualExpensesTotal).toBeCloseTo(219);
    expect(model.kpis.annualExpensesCount).toBe(3);
    expect(model.kpis.expensesByType).toEqual([
      {
        expenseType: "acquisto_materiale",
        label: "Acquisto materiale",
        amount: 200,
        count: 2,
      },
      {
        expenseType: "spostamento_km",
        label: "Spostamento Km",
        amount: 19,
        count: 1,
      },
    ]);
  });

  it("returns zero expenses when none exist in the selected year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T09:00:00.000Z"));

    const model = buildDashboardModel({
      payments: [],
      quotes: [],
      services: [],
      projects: [],
      clients: [],
      expenses: [],
      year: 2025,
    });

    expect(model.kpis.annualExpensesTotal).toBe(0);
    expect(model.kpis.annualExpensesCount).toBe(0);
    expect(model.kpis.expensesByType).toEqual([]);
  });
});
