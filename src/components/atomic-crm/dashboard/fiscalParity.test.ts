import { describe, expect, it } from "vitest";

import { buildFiscalDeadlineKey as buildClientFiscalDeadlineKey } from "./buildFiscalDeadlineKey";
import {
  buildAdvancePlanFromEstimate as buildClientAdvancePlanFromEstimate,
  buildFiscalPaymentSchedule as buildClientFiscalPaymentSchedule,
} from "./fiscalDeadlines";
import { buildFiscalYearEstimate as buildClientFiscalYearEstimate } from "./fiscalModel";
import type {
  FiscalConfig as ClientFiscalConfig,
  Payment,
  Project,
} from "../types";
import {
  buildFiscalDeadlineKey as buildServerFiscalDeadlineKey,
  buildFiscalReminderComputation as buildServerFiscalReminderComputation,
  buildFiscalYearEstimate as buildServerFiscalYearEstimate,
  type FiscalConfig as ServerFiscalConfig,
  type PaymentRow,
  type ProjectRow,
} from "../../../../supabase/functions/_shared/fiscalDeadlineCalculation.ts";

type SyntheticPayment = {
  id: number;
  client_id: string | null;
  project_id: string | null;
  payment_date: string;
  payment_type: "saldo" | "rimborso";
  amount: number;
  status: "ricevuto" | "in_attesa";
};

type SyntheticProject = {
  id: string;
  client_id: string;
  category: string | null;
};

const fiscalConfig: ClientFiscalConfig = {
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
  overrides: Partial<ClientFiscalConfig> = {},
): ClientFiscalConfig => ({
  ...fiscalConfig,
  ...overrides,
  taxProfiles: overrides.taxProfiles ?? fiscalConfig.taxProfiles,
  taxabilityDefaults: {
    ...fiscalConfig.taxabilityDefaults,
    ...overrides.taxabilityDefaults,
  },
});

const toClientConfig = (config: ClientFiscalConfig): ClientFiscalConfig =>
  config;
const toServerConfig = (config: ClientFiscalConfig): ServerFiscalConfig =>
  config as unknown as ServerFiscalConfig;

const toClientPayments = (payments: SyntheticPayment[]): Payment[] =>
  payments.map((payment) => ({
    id: payment.id,
    client_id: payment.client_id,
    project_id: payment.project_id,
    payment_date: payment.payment_date,
    payment_type: payment.payment_type,
    amount: payment.amount,
    status: payment.status,
    created_at: "2026-01-01T00:00:00.000Z",
  }));

const toServerPayments = (payments: SyntheticPayment[]): PaymentRow[] =>
  payments.map((payment) => ({
    amount: payment.amount,
    payment_date: payment.payment_date,
    status: payment.status,
    project_id: payment.project_id,
    client_id: payment.client_id,
    payment_type: payment.payment_type,
  }));

const toClientProjects = (projects: SyntheticProject[]): Project[] =>
  projects.map((project) => ({
    id: project.id,
    client_id: project.client_id,
    name: `Project ${project.id}`,
    category: project.category ?? "produzione_tv",
    status: "in_corso",
    all_day: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  }));

const toServerProjects = (projects: SyntheticProject[]): ProjectRow[] =>
  projects.map((project) => ({
    id: project.id,
    category: project.category,
  }));

const normalizeEstimate = (
  estimate: ReturnType<typeof buildClientFiscalYearEstimate>,
) => ({
  fiscalKpis: estimate.fiscalKpis,
  warnings: estimate.warnings.map((warning) => ({
    code: warning.code,
    severity: warning.severity,
    message: warning.message,
    amount: warning.amount,
    taxYear: warning.taxYear,
  })),
});

const normalizeSchedule = (
  schedule:
    | ReturnType<typeof buildClientFiscalPaymentSchedule>
    | ReturnType<typeof buildServerFiscalReminderComputation>["schedule"],
) => ({
  paymentYear: schedule.paymentYear,
  basisTaxYear: schedule.basisTaxYear,
  isFirstYear: schedule.isFirstYear,
  supportingTaxYears: schedule.supportingTaxYears,
  method: schedule.method,
  confidence: schedule.confidence,
  assumptions: schedule.assumptions,
  deadlines: schedule.deadlines.map((deadline) => ({
    paymentYear: deadline.paymentYear,
    method: deadline.method,
    supportingTaxYears: deadline.supportingTaxYears,
    confidence: deadline.confidence,
    assumptions: deadline.assumptions,
    date: deadline.date,
    label: deadline.label,
    totalAmount: deadline.totalAmount,
    isPast: deadline.isPast,
    daysUntil: deadline.daysUntil,
    priority: deadline.priority,
    items: deadline.items.map((item) => ({
      description: item.description,
      amount: item.amount,
      competenceYear: item.competenceYear,
      component: item.component,
    })),
  })),
});

const estimateScenarios = [
  {
    name: "mappedTaxable_basic",
    taxYear: 2026,
    config: makeFiscalConfig(),
    payments: [
      {
        id: 1,
        client_id: "client-1",
        project_id: "project-1",
        payment_date: "2026-02-01T00:00:00.000Z",
        payment_type: "saldo",
        amount: 1000,
        status: "ricevuto",
      },
    ] satisfies SyntheticPayment[],
    projects: [
      { id: "project-1", client_id: "client-1", category: "produzione_tv" },
    ] satisfies SyntheticProject[],
  },
  {
    name: "nonTaxable_excluded",
    taxYear: 2026,
    config: makeFiscalConfig({
      taxabilityDefaults: {
        nonTaxableCategories: [],
        nonTaxableClientIds: ["client-2"],
      },
    }),
    payments: [
      {
        id: 1,
        client_id: "client-1",
        project_id: "project-1",
        payment_date: "2026-02-01T00:00:00.000Z",
        payment_type: "saldo",
        amount: 1000,
        status: "ricevuto",
      },
      {
        id: 2,
        client_id: "client-2",
        project_id: "project-2",
        payment_date: "2026-02-15T00:00:00.000Z",
        payment_type: "saldo",
        amount: 500,
        status: "ricevuto",
      },
    ] satisfies SyntheticPayment[],
    projects: [
      { id: "project-1", client_id: "client-1", category: "produzione_tv" },
      { id: "project-2", client_id: "client-2", category: "produzione_tv" },
    ] satisfies SyntheticProject[],
  },
  {
    name: "unmapped_missingFallback",
    taxYear: 2026,
    config: makeFiscalConfig({
      defaultTaxProfileAtecoCode: "",
    }),
    payments: [
      {
        id: 1,
        client_id: "client-1",
        project_id: null,
        payment_date: "2026-05-01T00:00:00.000Z",
        payment_type: "saldo",
        amount: 450,
        status: "ricevuto",
      },
    ] satisfies SyntheticPayment[],
    projects: [] satisfies SyntheticProject[],
  },
  {
    name: "invalidFallbackConfig_unmappedWarning",
    taxYear: 2026,
    config: makeFiscalConfig({
      defaultTaxProfileAtecoCode: "999999",
    }),
    payments: [
      {
        id: 1,
        client_id: "client-1",
        project_id: null,
        payment_date: "2026-04-01T00:00:00.000Z",
        payment_type: "saldo",
        amount: 700,
        status: "ricevuto",
      },
    ] satisfies SyntheticPayment[],
    projects: [] satisfies SyntheticProject[],
  },
  {
    name: "refundHeavy_negativeRawCash",
    taxYear: 2026,
    config: makeFiscalConfig(),
    payments: [
      {
        id: 1,
        client_id: "client-1",
        project_id: "project-1",
        payment_date: "2026-01-10T00:00:00.000Z",
        payment_type: "saldo",
        amount: 100,
        status: "ricevuto",
      },
      {
        id: 2,
        client_id: "client-1",
        project_id: "project-1",
        payment_date: "2026-01-20T00:00:00.000Z",
        payment_type: "rimborso",
        amount: 300,
        status: "ricevuto",
      },
    ] satisfies SyntheticPayment[],
    projects: [
      { id: "project-1", client_id: "client-1", category: "produzione_tv" },
    ] satisfies SyntheticProject[],
  },
];

const scheduleScenarios = [
  {
    name: "schedule_firstYear",
    paymentYear: 2023,
    todayIso: "2023-01-15",
    config: makeFiscalConfig(),
    payments: [] satisfies SyntheticPayment[],
    projects: [] satisfies SyntheticProject[],
  },
  {
    name: "schedule_secondYear_singleAdvance",
    paymentYear: 2024,
    todayIso: "2024-01-15",
    config: makeFiscalConfig(),
    payments: [
      {
        id: 1,
        client_id: "client-1",
        project_id: "project-1",
        payment_date: "2023-02-01T00:00:00.000Z",
        payment_type: "saldo",
        amount: 2000,
        status: "ricevuto",
      },
    ] satisfies SyntheticPayment[],
    projects: [
      { id: "project-1", client_id: "client-1", category: "produzione_tv" },
    ] satisfies SyntheticProject[],
  },
  {
    name: "schedule_doubleAdvance",
    paymentYear: 2026,
    todayIso: "2026-01-15",
    config: makeFiscalConfig(),
    payments: [
      {
        id: 1,
        client_id: "client-1",
        project_id: "project-1",
        payment_date: "2025-03-01T00:00:00.000Z",
        payment_type: "saldo",
        amount: 10000,
        status: "ricevuto",
      },
    ] satisfies SyntheticPayment[],
    projects: [
      { id: "project-1", client_id: "client-1", category: "produzione_tv" },
    ] satisfies SyntheticProject[],
  },
];

describe("fiscal parity - estimate scenarios", () => {
  for (const scenario of estimateScenarios) {
    it(scenario.name, () => {
      const clientEstimate = buildClientFiscalYearEstimate({
        payments: toClientPayments(scenario.payments),
        projects: toClientProjects(scenario.projects),
        fiscalConfig: toClientConfig(scenario.config),
        taxYear: scenario.taxYear,
        monthsOfData: 12,
      });
      const serverEstimate = buildServerFiscalYearEstimate({
        payments: toServerPayments(scenario.payments),
        projects: toServerProjects(scenario.projects),
        fiscalConfig: toServerConfig(scenario.config),
        taxYear: scenario.taxYear,
        monthsOfData: 12,
      });

      expect(normalizeEstimate(serverEstimate)).toEqual(
        normalizeEstimate(clientEstimate),
      );
    });
  }
});

describe("fiscal parity - schedule scenarios", () => {
  for (const scenario of scheduleScenarios) {
    it(scenario.name, () => {
      const clientPayments = toClientPayments(scenario.payments);
      const clientProjects = toClientProjects(scenario.projects);
      const clientPreviousYearEstimate = buildClientFiscalYearEstimate({
        payments: clientPayments,
        projects: clientProjects,
        fiscalConfig: toClientConfig(scenario.config),
        taxYear: scenario.paymentYear - 1,
      });
      const clientTwoYearsBackEstimate = buildClientFiscalYearEstimate({
        payments: clientPayments,
        projects: clientProjects,
        fiscalConfig: toClientConfig(scenario.config),
        taxYear: scenario.paymentYear - 2,
      });
      const clientSchedule = buildClientFiscalPaymentSchedule({
        paymentYear: scenario.paymentYear,
        basisEstimate: clientPreviousYearEstimate.scheduleInput,
        priorAdvancePlan: buildClientAdvancePlanFromEstimate({
          estimate: clientTwoYearsBackEstimate.scheduleInput,
        }),
        annoInizioAttivita: scenario.config.annoInizioAttivita,
        todayIso: scenario.todayIso,
      });

      const serverComputation = buildServerFiscalReminderComputation({
        config: toServerConfig(scenario.config),
        payments: toServerPayments(scenario.payments),
        projects: toServerProjects(scenario.projects),
        paymentYear: scenario.paymentYear,
        todayIso: scenario.todayIso,
      });

      expect(normalizeSchedule(serverComputation.schedule)).toEqual(
        normalizeSchedule(clientSchedule),
      );
      expect(serverComputation.schedule.supportingTaxYears).toEqual(
        clientSchedule.supportingTaxYears,
      );
      expect(
        serverComputation.schedule.deadlines.map((deadline) =>
          buildServerFiscalDeadlineKey(deadline),
        ),
      ).toEqual(
        clientSchedule.deadlines.map((deadline) =>
          buildClientFiscalDeadlineKey(deadline),
        ),
      );
    });
  }
});
