import { expenseTypeLabels } from "@/components/atomic-crm/expenses/expenseTypes";
import { paymentStatusLabels } from "@/components/atomic-crm/payments/paymentTypes";
import { projectStatusLabels } from "@/components/atomic-crm/projects/projectTypes";
import { buildQuotePaymentsSummary } from "@/components/atomic-crm/quotes/quotePaymentsSummary";
import { quoteStatusLabels } from "@/components/atomic-crm/quotes/quotesTypes";
import {
  formatClientBillingAddress,
  getClientBillingDisplayName,
} from "@/components/atomic-crm/clients/clientBilling";
import {
  compareContactsForClientContext,
  getContactDisplayName,
  getContactPrimaryEmail,
  getContactPrimaryPhone,
  getContactResolvedRole,
  getContactRoleLabel,
  isContactPrimaryForClient,
} from "@/components/atomic-crm/contacts/contactRecord";
import type {
  Client,
  Contact,
  Expense,
  Payment,
  ProjectContact,
  Project,
  Quote,
  Service,
} from "@/components/atomic-crm/types";
import type { CrmCapabilityRegistry } from "@/lib/semantics/crmCapabilityRegistry";
import {
  calculateKmReimbursement,
  calculateServiceNetValue,
  type CrmSemanticRegistry,
} from "@/lib/semantics/crmSemanticRegistry";

const openQuoteClosedStatuses = new Set([
  "saldato",
  "rifiutato",
  "perso",
  "completato",
]);
const inactiveProjectStatuses = new Set(["completato", "cancellato"]);

const toDateValue = (value?: string | null) => {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? Number.NEGATIVE_INFINITY : date.valueOf();
};

const formatDateTimeLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  return date.toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const getExpenseOperationalAmount = (expense: Expense) => {
  if (expense.expense_type === "credito_ricevuto") {
    return -Number(expense.amount ?? 0);
  }

  if (expense.expense_type === "spostamento_km") {
    return calculateKmReimbursement({
      kmDistance: expense.km_distance,
      kmRate: expense.km_rate,
    });
  }

  return Number(expense.amount ?? 0) * (1 + Number(expense.markup_percent ?? 0) / 100);
};

const buildProjectFinancialSummaries = ({
  projects,
  services,
  payments,
  expenses,
}: {
  projects: Project[];
  services: Service[];
  payments: Payment[];
  expenses: Expense[];
}) => {
  const summaries = new Map(
    projects.map((project) => [
      String(project.id),
      {
        totalServices: 0,
        totalFees: 0,
        totalExpenses: 0,
        totalPaid: 0,
        balanceDue: 0,
      },
    ]),
  );

  services.forEach((service) => {
    const projectId = service.project_id ? String(service.project_id) : null;
    if (!projectId) {
      return;
    }

    const current = summaries.get(projectId);
    if (!current) {
      return;
    }

    current.totalServices += 1;
    current.totalFees += calculateServiceNetValue(service);
  });

  expenses.forEach((expense) => {
    const projectId = expense.project_id ? String(expense.project_id) : null;
    if (!projectId) {
      return;
    }

    const current = summaries.get(projectId);
    if (!current) {
      return;
    }

    current.totalExpenses += getExpenseOperationalAmount(expense);
  });

  payments.forEach((payment) => {
    const projectId = payment.project_id ? String(payment.project_id) : null;
    if (!projectId || payment.status !== "ricevuto") {
      return;
    }

    const current = summaries.get(projectId);
    if (!current) {
      return;
    }

    current.totalPaid +=
      payment.payment_type === "rimborso"
        ? -Number(payment.amount ?? 0)
        : Number(payment.amount ?? 0);
  });

  summaries.forEach((summary) => {
    summary.balanceDue =
      summary.totalFees + summary.totalExpenses - summary.totalPaid;
  });

  return summaries;
};

const getClientName = (
  clientById: Map<string, Client>,
  clientId?: Client["id"] | null,
) =>
  clientId
    ? getClientBillingDisplayName(clientById.get(String(clientId))) ??
      "Cliente non trovato"
    : null;

const getProjectName = (
  projectById: Map<string, Pick<Project, "id" | "name">>,
  projectId?: Project["id"] | null,
) =>
  projectId ? projectById.get(String(projectId))?.name ?? "Progetto non trovato" : null;

type SnapshotContactReference = {
  contactId: string;
  displayName: string;
  role: string | null;
  roleLabel: string | null;
  title: string | null;
  isPrimaryForClient: boolean;
  email: string | null;
  phone: string | null;
};

type SnapshotProjectReference = {
  projectId: string;
  projectName: string;
  status: string;
  statusLabel: string;
};

const buildSnapshotContactReference = (
  contact: Contact,
): SnapshotContactReference => {
  const role = getContactResolvedRole(contact);

  return {
    contactId: String(contact.id),
    displayName: getContactDisplayName(contact),
    role,
    roleLabel: getContactRoleLabel(role),
    title: contact.title ?? null,
    isPrimaryForClient: isContactPrimaryForClient(contact),
    email: getContactPrimaryEmail(contact),
    phone: getContactPrimaryPhone(contact),
  };
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
  };
  caveats: string[];
};

export const buildUnifiedCrmReadContext = ({
  clients,
  contacts,
  quotes,
  projects,
  projectContacts,
  services,
  payments,
  expenses,
  semanticRegistry,
  capabilityRegistry,
  generatedAt = new Date().toISOString(),
}: {
  clients: Client[];
  contacts: Contact[];
  quotes: Quote[];
  projects: Project[];
  projectContacts: ProjectContact[];
  services: Service[];
  payments: Payment[];
  expenses: Expense[];
  semanticRegistry: CrmSemanticRegistry;
  capabilityRegistry: CrmCapabilityRegistry;
  generatedAt?: string;
}): UnifiedCrmReadContext => {
  const clientById = new Map(clients.map((client) => [String(client.id), client]));
  const projectById = new Map(
    projects.map((project) => [String(project.id), project]),
  );
  const contactById = new Map(
    contacts.map((contact) => [String(contact.id), contact]),
  );
  const projectFinancialsById = buildProjectFinancialSummaries({
    projects,
    services,
    payments,
    expenses,
  });
  const paymentsByQuoteId = new Map<string, Payment[]>();
  const contactsByClientId = new Map<string, Contact[]>();
  const projectContactsByProjectId = new Map<string, ProjectContact[]>();
  const projectContactsByContactId = new Map<string, ProjectContact[]>();
  const activeProjectsByClientId = new Map<string, Project[]>();

  payments.forEach((payment) => {
    if (!payment.quote_id) {
      return;
    }

    const quoteId = String(payment.quote_id);
    const current = paymentsByQuoteId.get(quoteId) ?? [];
    current.push(payment);
    paymentsByQuoteId.set(quoteId, current);
  });

  contacts.forEach((contact) => {
    if (!contact.client_id) {
      return;
    }

    const clientId = String(contact.client_id);
    const current = contactsByClientId.get(clientId) ?? [];
    current.push(contact);
    contactsByClientId.set(clientId, current);
  });

  const openQuotes = quotes
    .filter((quote) => !openQuoteClosedStatuses.has(quote.status))
    .sort((left, right) => toDateValue(right.created_at) - toDateValue(left.created_at));
  const activeProjects = projects
    .filter((project) => !inactiveProjectStatuses.has(project.status))
    .sort((left, right) => toDateValue(right.start_date) - toDateValue(left.start_date));

  activeProjects.forEach((project) => {
    if (!project.client_id) {
      return;
    }

    const clientId = String(project.client_id);
    const current = activeProjectsByClientId.get(clientId) ?? [];
    current.push(project);
    activeProjectsByClientId.set(clientId, current);
  });

  projectContacts.forEach((projectContact) => {
    const projectId = projectContact.project_id
      ? String(projectContact.project_id)
      : null;
    const contactId = projectContact.contact_id
      ? String(projectContact.contact_id)
      : null;

    if (!projectId || !contactId || !projectById.has(projectId) || !contactById.has(contactId)) {
      return;
    }

    const currentProjectRows = projectContactsByProjectId.get(projectId) ?? [];
    currentProjectRows.push(projectContact);
    projectContactsByProjectId.set(projectId, currentProjectRows);

    const currentContactRows = projectContactsByContactId.get(contactId) ?? [];
    currentContactRows.push(projectContact);
    projectContactsByContactId.set(contactId, currentContactRows);
  });

  const pendingPayments = payments
    .filter(
      (payment) =>
        payment.status !== "ricevuto" && payment.payment_type !== "rimborso",
    )
    .sort(
      (left, right) =>
        toDateValue(left.payment_date ?? left.created_at) -
        toDateValue(right.payment_date ?? right.created_at),
    );
  const recentExpenses = [...expenses].sort(
    (left, right) => toDateValue(right.expense_date) - toDateValue(left.expense_date),
  );
  const recentClients = [...clients].sort(
    (left, right) => toDateValue(right.created_at) - toDateValue(left.created_at),
  );
  const recentContacts = [...contacts].sort((left, right) => {
    const primaryDelta =
      Number(isContactPrimaryForClient(right)) -
      Number(isContactPrimaryForClient(left));

    if (primaryDelta !== 0) {
      return primaryDelta;
    }

    return (
      toDateValue(right.updated_at ?? right.created_at) -
      toDateValue(left.updated_at ?? left.created_at)
    );
  });

  const openQuotesAmount = openQuotes.reduce(
    (sum, quote) => sum + Number(quote.amount ?? 0),
    0,
  );
  const pendingPaymentsAmount = pendingPayments.reduce(
    (sum, payment) => sum + Number(payment.amount ?? 0),
    0,
  );
  const expensesAmount = recentExpenses.reduce(
    (sum, expense) => sum + Number(expense.amount ?? 0),
    0,
  );

  const getClientContacts = (clientId: string) =>
    [...(contactsByClientId.get(clientId) ?? [])]
      .sort(compareContactsForClientContext)
      .map((contact) => buildSnapshotContactReference(contact))
      .slice(0, 3);

  const getClientActiveProjects = (clientId: string) =>
    [...(activeProjectsByClientId.get(clientId) ?? [])]
      .sort(
        (left, right) =>
          toDateValue(right.start_date ?? right.created_at) -
          toDateValue(left.start_date ?? left.created_at),
      )
      .map((project) => ({
        projectId: String(project.id),
        projectName: project.name,
        status: project.status,
        statusLabel: projectStatusLabels[project.status] ?? project.status,
      }))
      .slice(0, 3);

  const getProjectContacts = (projectId: string) =>
    [...(projectContactsByProjectId.get(projectId) ?? [])]
      .sort((left, right) => {
        if (left.is_primary !== right.is_primary) {
          return left.is_primary ? -1 : 1;
        }

        const leftContact = contactById.get(String(left.contact_id));
        const rightContact = contactById.get(String(right.contact_id));

        if (!leftContact || !rightContact) {
          return 0;
        }

        return compareContactsForClientContext(leftContact, rightContact);
      })
      .flatMap((projectContact) => {
        const contact = contactById.get(String(projectContact.contact_id));
        if (!contact) {
          return [];
        }

        return [
          {
            ...buildSnapshotContactReference(contact),
            isPrimary: projectContact.is_primary === true,
          },
        ];
      })
      .slice(0, 4);

  const getContactLinkedProjects = (contactId: string) =>
    [...(projectContactsByContactId.get(contactId) ?? [])]
      .sort((left, right) => {
        if (left.is_primary !== right.is_primary) {
          return left.is_primary ? -1 : 1;
        }

        const leftProject = projectById.get(String(left.project_id));
        const rightProject = projectById.get(String(right.project_id));
        return (
          toDateValue(rightProject?.start_date ?? rightProject?.created_at) -
          toDateValue(leftProject?.start_date ?? leftProject?.created_at)
        );
      })
      .flatMap((projectContact) => {
        const project = projectById.get(String(projectContact.project_id));
        if (!project) {
          return [];
        }

        return [
          {
            projectId: String(project.id),
            projectName: project.name,
            status: project.status,
            statusLabel: projectStatusLabels[project.status] ?? project.status,
            isPrimary: projectContact.is_primary === true,
          },
        ];
      })
      .slice(0, 4);

  return {
    meta: {
      generatedAt,
      generatedAtLabel: formatDateTimeLabel(generatedAt),
      businessTimezone: "Europe/Rome",
      routePrefix: capabilityRegistry.routing.routePrefix,
      scope: "crm_read_snapshot",
    },
    registries: {
      semantic: semanticRegistry,
      capability: capabilityRegistry,
    },
    snapshot: {
      counts: {
        clients: clients.length,
        contacts: contacts.length,
        quotes: quotes.length,
        openQuotes: openQuotes.length,
        activeProjects: activeProjects.length,
        pendingPayments: pendingPayments.length,
        expenses: expenses.length,
      },
      totals: {
        openQuotesAmount,
        pendingPaymentsAmount,
        expensesAmount,
      },
      recentClients: recentClients.slice(0, 5).map((client) => ({
        clientId: String(client.id),
        clientName: getClientBillingDisplayName(client) ?? client.name,
        operationalName: client.name ?? null,
        billingName: client.billing_name ?? null,
        email: client.email ?? null,
        vatNumber: client.vat_number ?? null,
        fiscalCode: client.fiscal_code ?? null,
        billingAddress: formatClientBillingAddress(client),
        billingCity: client.billing_city ?? null,
        billingSdiCode: client.billing_sdi_code ?? null,
        billingPec: client.billing_pec ?? null,
        contacts: getClientContacts(String(client.id)),
        activeProjects: getClientActiveProjects(String(client.id)),
        createdAt: client.created_at,
      })),
      recentContacts: recentContacts.slice(0, 5).map((contact) => ({
        ...buildSnapshotContactReference(contact),
        clientId: contact.client_id ? String(contact.client_id) : null,
        clientName: getClientName(clientById, contact.client_id ?? null),
        linkedProjects: getContactLinkedProjects(String(contact.id)),
        updatedAt: contact.updated_at ?? contact.created_at,
      })),
      openQuotes: openQuotes.slice(0, 5).map((quote) => {
        const paymentSummary = buildQuotePaymentsSummary({
          quoteAmount: Number(quote.amount ?? 0),
          payments: paymentsByQuoteId.get(String(quote.id)) ?? [],
        });

        return {
          quoteId: String(quote.id),
          clientId: quote.client_id ? String(quote.client_id) : null,
          projectId: quote.project_id ? String(quote.project_id) : null,
          clientName:
            getClientName(clientById, quote.client_id) ?? "Cliente non trovato",
          projectName: getProjectName(projectById, quote.project_id ?? null),
          amount: Number(quote.amount ?? 0),
          linkedPaymentsTotal: paymentSummary.linkedTotal,
          remainingAmount: paymentSummary.remainingAmount,
          status: quote.status,
          statusLabel: quoteStatusLabels[quote.status] ?? quote.status,
          createdAt: quote.created_at,
        };
      }),
      activeProjects: activeProjects.slice(0, 5).map((project) => {
        const projectFinancials =
          projectFinancialsById.get(String(project.id)) ?? {
            totalServices: 0,
            totalFees: 0,
            totalExpenses: 0,
            totalPaid: 0,
            balanceDue: 0,
          };

        return {
          projectId: String(project.id),
          clientId: project.client_id ? String(project.client_id) : null,
          projectName: project.name,
          clientName: getClientName(clientById, project.client_id),
          projectCategory: project.category ?? null,
          projectTvShow: project.tv_show ?? null,
          status: project.status,
          statusLabel: projectStatusLabels[project.status] ?? project.status,
          startDate: project.start_date ?? null,
          totalServices: projectFinancials.totalServices,
          totalFees: projectFinancials.totalFees,
          totalExpenses: projectFinancials.totalExpenses,
          totalPaid: projectFinancials.totalPaid,
          balanceDue: projectFinancials.balanceDue,
          contacts: getProjectContacts(String(project.id)),
        };
      }),
      pendingPayments: pendingPayments.slice(0, 20).map((payment) => ({
        paymentId: String(payment.id),
        quoteId: payment.quote_id ? String(payment.quote_id) : null,
        clientId: payment.client_id ? String(payment.client_id) : null,
        projectId: payment.project_id ? String(payment.project_id) : null,
        clientName: getClientName(clientById, payment.client_id),
        projectName: getProjectName(projectById, payment.project_id ?? null),
        amount: Number(payment.amount ?? 0),
        status: payment.status,
        statusLabel: paymentStatusLabels[payment.status] ?? payment.status,
        paymentDate: payment.payment_date ?? null,
      })),
      recentExpenses: recentExpenses.slice(0, 5).map((expense) => ({
        expenseId: String(expense.id),
        clientId: expense.client_id ? String(expense.client_id) : null,
        projectId: expense.project_id ? String(expense.project_id) : null,
        clientName: getClientName(clientById, expense.client_id ?? null),
        projectName: getProjectName(projectById, expense.project_id ?? null),
        amount: Number(expense.amount ?? 0),
        expenseType: expense.expense_type,
        expenseTypeLabel:
          expenseTypeLabels[expense.expense_type] ?? expense.expense_type,
        expenseDate: expense.expense_date,
        description: expense.description ?? null,
      })),
      clientLevelServices: services
        .filter((s) => !s.project_id && s.client_id)
        .slice(0, 10)
        .map((s) => ({
          serviceId: String(s.id),
          clientId: s.client_id ? String(s.client_id) : null,
          clientName: getClientName(clientById, s.client_id ?? null),
          serviceType: s.service_type,
          amount: calculateServiceNetValue(s),
          isTaxable: s.is_taxable !== false,
          serviceDate: s.service_date,
          notes: s.notes ?? null,
        })),
    },
    caveats: [
      "Questo snapshot e' read-only: nessuna scrittura nel CRM parte da questo contesto o dalle risposte AI che lo usano senza una conferma esplicita in un workflow dedicato.",
      "I significati di stati, tipi, formule e route vanno letti dai registri semantico e capability inclusi nel contesto.",
      "Le liste recenti sono intenzionalmente limitate ai record piu utili per lettura rapida nel launcher unificato, ma ora espongono anche relazioni strutturate cliente-progetto-referente gia presenti nel CRM.",
    ],
  };
};
