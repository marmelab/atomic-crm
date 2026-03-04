import { describe, expect, it } from "vitest";

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
  ],
  aliquotaINPS: 26.07,
  tettoFatturato: 85000,
  annoInizioAttivita: 2023,
};

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

describe("buildFiscalModel", () => {
  it("keeps operational revenue separate from the taxable fiscal base", () => {
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
      baseService({
        id: 1,
        project_id: 1,
        fee_shooting: 400,
        is_taxable: true,
      }),
      baseService({
        id: 2,
        project_id: 2,
        fee_shooting: 300,
        is_taxable: false,
      }),
      baseService({
        id: 3,
        project_id: 3,
        fee_shooting: 200,
        is_taxable: true,
      }),
      baseService({
        id: 4,
        project_id: 4,
        fee_shooting: 100,
        is_taxable: true,
      }),
    ];

    const model = buildFiscalModel({
      services,
      expenses: [] satisfies Expense[],
      payments: [] satisfies Payment[],
      quotes: [] satisfies Quote[],
      projects,
      clients,
      fiscalConfig,
      year: 2026,
    });

    expect(model.fiscalKpis.fatturatoLordoYtd).toBe(700);
    expect(model.fiscalKpis.redditoLordoForfettario).toBe(546);
    expect(model.businessHealth.marginPerCategory).toEqual([
      {
        category: "produzione_tv",
        label: "Produzione TV",
        margin: 100,
        revenue: 1000,
        expenses: 0,
      },
    ]);
    expect(model.businessHealth.clientConcentration).toBeCloseTo(90, 5);
  });

  it("includes flat taxable services and excludes flat non-taxable services from fiscal revenue", () => {
    const clients: Client[] = [baseClient({ id: 1, name: "Cliente Flat" })];

    const services: Service[] = [
      baseService({
        id: 101,
        project_id: null,
        client_id: 1,
        fee_shooting: 500,
        is_taxable: true,
      }),
      baseService({
        id: 102,
        project_id: null,
        client_id: 1,
        fee_shooting: 300,
        is_taxable: false,
      }),
    ];

    const model = buildFiscalModel({
      services,
      expenses: [] satisfies Expense[],
      payments: [] satisfies Payment[],
      quotes: [] satisfies Quote[],
      projects: [] satisfies Project[],
      clients,
      fiscalConfig,
      year: 2026,
    });

    expect(model.fiscalKpis.fatturatoTotaleYtd).toBe(800);
    expect(model.fiscalKpis.fatturatoLordoYtd).toBe(500);
    expect(model.fiscalKpis.fatturatoNonTassabileYtd).toBe(300);
    expect(
      model.warnings.some((warning) => warning.type === "unclassified_revenue"),
    ).toBe(false);
  });
});
