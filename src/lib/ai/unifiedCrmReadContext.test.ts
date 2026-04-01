import { afterEach, describe, expect, it, vi } from "vitest";

import { buildCrmCapabilityRegistry } from "@/lib/semantics/crmCapabilityRegistry";
import { buildCrmSemanticRegistry } from "@/lib/semantics/crmSemanticRegistry";

import { buildUnifiedCrmReadContext } from "./unifiedCrmReadContext";

const dateWithOffset = (daysOffset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString();
};

afterEach(() => {
  vi.useRealTimers();
});

describe("unifiedCrmReadContext", () => {
  it("builds a read-only CRM snapshot with recent records and totals", () => {
    const context = buildUnifiedCrmReadContext({
      clients: [
        {
          id: "client-1",
          name: "Mario Rossi",
          billing_name: "MARIO ROSSI STUDIO",
          client_type: "privato_wedding",
          vat_number: "IT12345678901",
          fiscal_code: "RSSMRA80A01C351Z",
          billing_address_street: "Via Etnea",
          billing_address_number: "10",
          billing_postal_code: "95100",
          billing_city: "Catania",
          billing_province: "CT",
          billing_country: "IT",
          billing_sdi_code: "M5UXCR1",
          billing_pec: "mario@examplepec.it",
          tags: [],
          created_at: "2026-02-10T10:00:00.000Z",
          updated_at: "2026-02-10T10:00:00.000Z",
        },
      ],
      contacts: [
        {
          id: 101,
          first_name: "Diego",
          last_name: "Caltabiano",
          contact_role: "operativo",
          is_primary_for_client: true,
          title: "Referente operativo",
          client_id: "client-1",
          email_jsonb: [{ email: "diego@gustare.it", type: "Work" }],
          phone_jsonb: [{ number: "+39 333 1234567", type: "Work" }],
          tags: [],
          created_at: "2026-02-12T10:00:00.000Z",
          updated_at: "2026-02-21T09:30:00.000Z",
        },
      ],
      quotes: [
        {
          id: "quote-1",
          client_id: "client-1",
          project_id: "project-1",
          service_type: "wedding",
          all_day: true,
          amount: 2200,
          status: "in_trattativa",
          is_taxable: true,
          index: 1,
          created_at: "2026-02-20T10:00:00.000Z",
          updated_at: "2026-02-20T10:00:00.000Z",
        },
        {
          id: "quote-2",
          client_id: "client-1",
          service_type: "wedding",
          all_day: true,
          amount: 1800,
          status: "saldato",
          is_taxable: true,
          index: 2,
          created_at: "2026-01-01T10:00:00.000Z",
          updated_at: "2026-01-01T10:00:00.000Z",
        },
      ],
      projects: [
        {
          id: "project-1",
          client_id: "client-1",
          name: "Wedding Mario",
          category: "wedding",
          status: "in_corso",
          all_day: true,
          created_at: "2026-02-01T10:00:00.000Z",
          updated_at: "2026-02-01T10:00:00.000Z",
        },
      ],
      projectContacts: [
        {
          id: "project-contact-1",
          project_id: "project-1",
          contact_id: 101,
          is_primary: true,
          created_at: "2026-02-12T10:00:00.000Z",
          updated_at: "2026-02-12T10:00:00.000Z",
        },
      ],
      services: [
        {
          id: "service-1",
          project_id: "project-1",
          service_date: "2026-02-20T00:00:00.000Z",
          all_day: true,
          is_taxable: true,
          service_type: "riprese_montaggio",
          fee_shooting: 1600,
          fee_editing: 400,
          fee_other: 200,
          discount: 0,
          km_distance: 0,
          km_rate: 0.19,
          created_at: "2026-02-18T10:00:00.000Z",
        },
      ],
      payments: [
        {
          id: "payment-1",
          client_id: "client-1",
          quote_id: "quote-1",
          project_id: "project-1",
          payment_type: "saldo",
          amount: 1200,
          status: "in_attesa",
          payment_date: dateWithOffset(3),
          created_at: "2026-02-22T10:00:00.000Z",
        },
        {
          id: "payment-2",
          client_id: "client-1",
          payment_type: "saldo",
          amount: 1000,
          status: "ricevuto",
          payment_date: "2026-02-15T00:00:00.000Z",
          created_at: "2026-02-15T10:00:00.000Z",
        },
        {
          id: "payment-3",
          client_id: "client-1",
          quote_id: "quote-1",
          project_id: "project-1",
          payment_type: "acconto",
          amount: 350,
          status: "in_attesa",
          payment_date: dateWithOffset(-2),
          created_at: "2026-02-10T10:00:00.000Z",
        },
      ],
      expenses: [
        {
          id: "expense-1",
          client_id: "client-1",
          project_id: "project-1",
          expense_date: "2026-02-18T00:00:00.000Z",
          expense_type: "noleggio",
          amount: 300,
          description: "Noleggio luci",
          created_at: "2026-02-18T10:00:00.000Z",
        },
      ],
      projectFinancialRows: [
        {
          project_id: "project-1",
          project_name: "Wedding Mario",
          client_id: "client-1",
          client_name: "MARIO ROSSI STUDIO",
          category: "wedding",
          total_services: 1,
          total_fees: 2200,
          total_km: 0,
          total_km_cost: 0,
          total_expenses: 300,
          total_owed: 2500,
          total_paid: 0,
          balance_due: 2500,
        },
      ],
      clientCommercialPositions: [
        {
          client_id: "client-1",
          client_name: "MARIO ROSSI STUDIO",
          total_fees: 2200,
          total_expenses: 300,
          total_owed: 2500,
          total_paid: 1000,
          balance_due: 1500,
          projects_count: 1,
        },
      ],
      tasks: [
        {
          id: "task-1",
          client_id: "client-1",
          text: "Chiamare per conferma",
          type: "call",
          due_date: dateWithOffset(2),
          all_day: true,
          done_date: null,
          created_at: "2026-02-25T10:00:00.000Z",
          updated_at: "2026-02-25T10:00:00.000Z",
        },
        {
          id: "task-2",
          client_id: "client-1",
          text: "Inviare materiale finale",
          type: "email",
          due_date: dateWithOffset(-1),
          all_day: true,
          done_date: null,
          created_at: "2026-02-20T10:00:00.000Z",
          updated_at: "2026-02-20T10:00:00.000Z",
        },
        {
          id: "task-3",
          client_id: "client-1",
          text: "Task completato",
          type: "reminder",
          due_date: dateWithOffset(1),
          all_day: true,
          done_date: "2026-02-26T10:00:00.000Z",
          created_at: "2026-02-19T10:00:00.000Z",
          updated_at: "2026-02-26T10:00:00.000Z",
        },
      ],
      semanticRegistry: buildCrmSemanticRegistry(),
      capabilityRegistry: buildCrmCapabilityRegistry(),
      generatedAt: "2026-02-28T22:30:00.000Z",
    });

    expect(context.meta.scope).toBe("crm_read_snapshot");
    expect(context.snapshot.counts.contacts).toBe(1);
    expect(context.snapshot.counts.openQuotes).toBe(1);
    expect(context.snapshot.counts.pendingPayments).toBe(2);
    expect(context.snapshot.counts.overduePayments).toBe(1);
    expect(context.snapshot.counts.upcomingTasks).toBe(1);
    expect(context.snapshot.counts.overdueTasks).toBe(1);
    expect(context.snapshot.totals.pendingPaymentsAmount).toBe(1550);
    expect(context.snapshot.totals.expensesAmount).toBe(300);
    expect(context.snapshot.openQuotes[0]?.clientId).toBe("client-1");
    expect(context.snapshot.openQuotes[0]?.clientName).toBe(
      "MARIO ROSSI STUDIO",
    );
    expect(context.snapshot.openQuotes[0]?.linkedPaymentsTotal).toBe(1550);
    expect(context.snapshot.openQuotes[0]?.remainingAmount).toBe(650);
    expect(context.snapshot.pendingPayments[0]?.quoteId).toBe("quote-1");
    expect(context.snapshot.pendingPayments[0]?.projectId).toBe("project-1");
    expect(context.snapshot.pendingPayments[0]?.isTaxable).toBe(true);
    expect(context.snapshot.overduePayments[0]?.paymentId).toBe("payment-3");
    expect(context.snapshot.upcomingTasks[0]?.taskId).toBe("task-1");
    expect(context.snapshot.overdueTasks[0]?.taskId).toBe("task-2");
    expect(context.snapshot.recentClients[0]?.billingName).toBe(
      "MARIO ROSSI STUDIO",
    );
    expect(context.snapshot.recentClients[0]?.vatNumber).toBe("IT12345678901");
    expect(context.snapshot.recentClients[0]?.billingAddress).toBe(
      "Via Etnea, 10 · 95100 Catania CT · IT",
    );
    expect(context.snapshot.recentClients[0]?.contacts[0]?.displayName).toBe(
      "Diego Caltabiano",
    );
    expect(context.snapshot.recentClients[0]?.contacts[0]?.roleLabel).toBe(
      "Operativo",
    );
    expect(
      context.snapshot.recentClients[0]?.contacts[0]?.isPrimaryForClient,
    ).toBe(true);
    expect(context.snapshot.recentClients[0]?.activeProjects[0]?.projectName).toBe(
      "Wedding Mario",
    );
    expect(context.snapshot.recentContacts[0]?.clientName).toBe(
      "MARIO ROSSI STUDIO",
    );
    expect(context.snapshot.recentContacts[0]?.roleLabel).toBe("Operativo");
    expect(context.snapshot.recentContacts[0]?.linkedProjects[0]?.projectName).toBe(
      "Wedding Mario",
    );
    expect(context.snapshot.recentContacts[0]?.linkedProjects[0]?.isPrimary).toBe(
      true,
    );
    expect(context.snapshot.recentClients[0]?.billingSdiCode).toBe("M5UXCR1");
    expect(context.snapshot.recentClients[0]?.billingPec).toBe(
      "mario@examplepec.it",
    );
    expect(context.snapshot.openQuotes[0]?.statusLabel).toBe("In trattativa");
    expect(context.snapshot.pendingPayments[0]?.statusLabel).toBe("In attesa");
    expect(context.snapshot.recentExpenses[0]?.expenseTypeLabel).toBe("Noleggio");
    expect(context.snapshot.recentExpenses[0]?.amount).toBe(300);
    expect(context.snapshot.activeProjects[0]?.totalFees).toBe(2200);
    expect(context.snapshot.activeProjects[0]?.totalExpenses).toBe(300);
    expect(context.snapshot.activeProjects[0]?.balanceDue).toBe(2500);
    expect(context.snapshot.activeProjects[0]?.expenses).toEqual([
      expect.objectContaining({
        expenseId: "expense-1",
        expenseType: "noleggio",
        expenseTypeLabel: "Noleggio",
        amount: 300,
        description: "Noleggio luci",
      }),
    ]);
    expect(context.snapshot.activeProjects[0]?.projectCategory).toBe("wedding");
    expect(context.snapshot.activeProjects[0]?.projectTvShow).toBeNull();
    expect(context.snapshot.activeProjects[0]?.contacts[0]).toEqual(
      expect.objectContaining({
        displayName: "Diego Caltabiano",
        email: "diego@gustare.it",
        roleLabel: "Operativo",
        isPrimaryForClient: true,
        isPrimary: true,
      }),
    );
    expect(context.registries.capability.routing.mode).toBe("hash");
    expect(context.registries.semantic.rules.invoiceImport.customerInvoiceResource).toBe(
      "payments",
    );
    expect(context.caveats[0]).toContain("read-only");
  });

  it("classifies tasks and payments by Europe/Rome business date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T23:30:00.000Z"));

    const context = buildUnifiedCrmReadContext({
      clients: [{ id: "client-1", name: "Mario Rossi", tags: [], created_at: "2026-02-10T10:00:00.000Z" }],
      contacts: [],
      quotes: [],
      projects: [],
      projectContacts: [],
      services: [],
      payments: [
        {
          id: "payment-today",
          client_id: "client-1",
          payment_type: "saldo",
          amount: 100,
          status: "in_attesa",
          payment_date: "2026-03-09T23:00:00.000Z",
          created_at: "2026-03-01T10:00:00.000Z",
        },
        {
          id: "payment-overdue",
          client_id: "client-1",
          payment_type: "saldo",
          amount: 50,
          status: "in_attesa",
          payment_date: "2026-03-08T23:00:00.000Z",
          created_at: "2026-03-01T10:00:00.000Z",
        },
      ],
      expenses: [],
      tasks: [
        {
          id: "task-today",
          client_id: "client-1",
          text: "Task di oggi",
          type: "call",
          due_date: "2026-03-09T23:00:00.000Z",
          all_day: true,
          done_date: null,
          created_at: "2026-03-01T10:00:00.000Z",
          updated_at: "2026-03-01T10:00:00.000Z",
        },
        {
          id: "task-overdue",
          client_id: "client-1",
          text: "Task in ritardo",
          type: "call",
          due_date: "2026-03-08T23:00:00.000Z",
          all_day: true,
          done_date: null,
          created_at: "2026-03-01T10:00:00.000Z",
          updated_at: "2026-03-01T10:00:00.000Z",
        },
      ],
      semanticRegistry: buildCrmSemanticRegistry(),
      capabilityRegistry: buildCrmCapabilityRegistry(),
      generatedAt: "2026-03-09T23:30:00.000Z",
    });

    expect(context.snapshot.counts.overduePayments).toBe(1);
    expect(context.snapshot.overduePayments[0]?.paymentId).toBe(
      "payment-overdue",
    );
    expect(context.snapshot.overduePayments[0]?.daysOverdue).toBe(1);
    expect(context.snapshot.counts.upcomingTasks).toBe(1);
    expect(context.snapshot.upcomingTasks[0]?.taskId).toBe("task-today");
    expect(context.snapshot.upcomingTasks[0]?.daysUntilDue).toBe(0);
    expect(context.snapshot.counts.overdueTasks).toBe(1);
    expect(context.snapshot.overdueTasks[0]?.taskId).toBe("task-overdue");
    expect(context.snapshot.overdueTasks[0]?.daysOverdue).toBe(1);
  });

  it("uses operational expense amounts for km rows and includes project expenses in project snapshots", () => {
    const context = buildUnifiedCrmReadContext({
      clients: [{ id: "client-1", name: "Mario Rossi", tags: [], created_at: "2026-02-10T10:00:00.000Z" }],
      contacts: [],
      quotes: [],
      projects: [
        {
          id: "project-1",
          client_id: "client-1",
          name: "Vale il Viaggio",
          category: "produzione_tv",
          status: "in_corso",
          all_day: true,
          created_at: "2026-02-01T10:00:00.000Z",
          updated_at: "2026-02-01T10:00:00.000Z",
        },
      ],
      projectContacts: [],
      services: [],
      payments: [],
      expenses: [
        {
          id: "expense-km-1",
          client_id: "client-1",
          project_id: "project-1",
          expense_date: "2026-03-27T00:00:00.000Z",
          expense_type: "spostamento_km",
          amount: 0,
          km_distance: 1341,
          km_rate: 0.19,
          description: "Trasferta Catania",
          created_at: "2026-03-27T10:00:00.000Z",
        },
      ],
      projectFinancialRows: [
        {
          project_id: "project-1",
          project_name: "Vale il Viaggio",
          client_id: "client-1",
          client_name: "Mario Rossi",
          category: "produzione_tv",
          total_services: 0,
          total_fees: 0,
          total_km: 1341,
          total_km_cost: 254.79,
          total_expenses: 254.79,
          total_owed: 254.79,
          total_paid: 0,
          balance_due: 254.79,
        },
      ],
      tasks: [],
      semanticRegistry: buildCrmSemanticRegistry(),
      capabilityRegistry: buildCrmCapabilityRegistry(),
      generatedAt: "2026-03-28T10:00:00.000Z",
    });

    expect(context.snapshot.totals.expensesAmount).toBe(254.79);
    expect(context.snapshot.recentExpenses[0]).toEqual(
      expect.objectContaining({
        expenseId: "expense-km-1",
        amount: 254.79,
        expenseType: "spostamento_km",
        expenseTypeLabel: "Spostamento Km",
      }),
    );
    expect(context.snapshot.activeProjects[0]?.expenses).toEqual([
      expect.objectContaining({
        expenseId: "expense-km-1",
        amount: 254.79,
        expenseType: "spostamento_km",
        expenseTypeLabel: "Spostamento Km",
        description: "Trasferta Catania",
      }),
    ]);
  });
});
