import type { CrmCapabilityRegistry } from "@/lib/semantics/crmCapabilityRegistry";
import type { CrmSemanticRegistry } from "@/lib/semantics/crmSemanticRegistry";

export type SnapshotContactReference = {
  contactId: string;
  displayName: string;
  role: string | null;
  roleLabel: string | null;
  title: string | null;
  isPrimaryForClient: boolean;
  email: string | null;
  phone: string | null;
};

export type SnapshotProjectReference = {
  projectId: string;
  projectName: string;
  status: string;
  statusLabel: string;
};

export type UnifiedCrmReadContext = {
  meta: {
    generatedAt: string;
    generatedAtLabel: string;
    businessTimezone: string;
    routePrefix: string;
    scope: "crm_read_snapshot";
  };
  registries: {
    semantic: CrmSemanticRegistry;
    capability: CrmCapabilityRegistry;
  };
  snapshot: {
    counts: {
      clients: number;
      contacts: number;
      quotes: number;
      openQuotes: number;
      activeProjects: number;
      pendingPayments: number;
      overduePayments: number;
      upcomingTasks: number;
      overdueTasks: number;
      expenses: number;
    };
    totals: {
      openQuotesAmount: number;
      pendingPaymentsAmount: number;
      expensesAmount: number;
    };
    recentClients: Array<{
      clientId: string;
      clientName: string;
      operationalName: string | null;
      billingName: string | null;
      email: string | null;
      vatNumber: string | null;
      fiscalCode: string | null;
      billingAddress: string | null;
      billingCity: string | null;
      billingSdiCode: string | null;
      billingPec: string | null;
      contacts: SnapshotContactReference[];
      activeProjects: SnapshotProjectReference[];
      createdAt: string;
    }>;
    recentContacts: Array<{
      contactId: string;
      displayName: string;
      role: string | null;
      roleLabel: string | null;
      title: string | null;
      isPrimaryForClient: boolean;
      email: string | null;
      phone: string | null;
      clientId: string | null;
      clientName: string | null;
      linkedProjects: Array<
        SnapshotProjectReference & {
          isPrimary: boolean;
        }
      >;
      updatedAt: string;
    }>;
    openQuotes: Array<{
      quoteId: string;
      clientId: string | null;
      projectId: string | null;
      clientName: string;
      projectName: string | null;
      amount: number;
      linkedPaymentsTotal: number;
      remainingAmount: number;
      status: string;
      statusLabel: string;
      createdAt: string;
    }>;
    activeProjects: Array<{
      projectId: string;
      clientId: string | null;
      projectName: string;
      clientName: string | null;
      projectCategory?: string | null;
      projectTvShow?: string | null;
      status: string;
      statusLabel: string;
      startDate: string | null;
      totalServices: number;
      totalFees: number;
      totalExpenses: number;
      totalPaid: number;
      balanceDue: number;
      contacts: Array<
        SnapshotContactReference & {
          isPrimary: boolean;
        }
      >;
    }>;
    pendingPayments: Array<{
      paymentId: string;
      quoteId: string | null;
      clientId: string | null;
      projectId: string | null;
      clientName: string | null;
      projectName: string | null;
      amount: number;
      status: string;
      statusLabel: string;
      paymentDate: string | null;
      isTaxable: boolean;
    }>;
    overduePayments: Array<{
      paymentId: string;
      quoteId: string | null;
      clientId: string | null;
      projectId: string | null;
      clientName: string | null;
      projectName: string | null;
      amount: number;
      status: string;
      statusLabel: string;
      paymentDate: string | null;
      isTaxable: boolean;
      daysOverdue: number | null;
    }>;
    upcomingTasks: Array<{
      taskId: string;
      clientId: string | null;
      clientName: string | null;
      text: string;
      type: string;
      dueDate: string;
      allDay: boolean;
      daysUntilDue: number;
    }>;
    overdueTasks: Array<{
      taskId: string;
      clientId: string | null;
      clientName: string | null;
      text: string;
      type: string;
      dueDate: string;
      allDay: boolean;
      daysOverdue: number;
    }>;
    recentExpenses: Array<{
      expenseId: string;
      clientId: string | null;
      projectId: string | null;
      clientName: string | null;
      projectName: string | null;
      amount: number;
      expenseType: string;
      expenseTypeLabel: string;
      expenseDate: string;
      description: string | null;
    }>;
    clientLevelServices: Array<{
      serviceId: string;
      clientId: string | null;
      clientName: string | null;
      serviceType: string;
      amount: number;
      isTaxable: boolean;
      serviceDate: string;
      notes: string | null;
    }>;
    clientFinancials: Array<{
      clientId: string;
      clientName: string;
      totalFees: number;
      totalPaid: number;
      balanceDue: number;
      hasUninvoicedServices: boolean;
    }>;
    activeWorkflows: Array<{
      workflowId: string;
      name: string;
      description: string | null;
      triggerResource: string;
      triggerResourceLabel: string;
      triggerEvent: string;
      triggerEventLabel: string;
      conditionsSummary: string | null;
      actionsSummary: string;
      isActive: boolean;
    }>;
  };
  caveats: string[];
};
