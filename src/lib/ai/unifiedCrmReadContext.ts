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
  ClientTask,
  Client,
  Contact,
  Expense,
  Payment,
  ProjectContact,
  Project,
  Quote,
  Service,
  Supplier,
  Workflow,
} from "@/components/atomic-crm/types";
import {
  triggerResourceLabels,
  triggerEventLabels,
  describeConditions,
  describeAction,
} from "@/components/atomic-crm/workflows/workflowTypes";
import type { CrmCapabilityRegistry } from "@/lib/semantics/crmCapabilityRegistry";
import {
  calculateServiceNetValue,
  isPaymentTaxable,
  type CrmSemanticRegistry,
} from "@/lib/semantics/crmSemanticRegistry";
import {
  buildProjectFinancialSummaries,
  buildClientFinancialSummaries,
  buildSupplierFinancialSummaries,
} from "./unifiedCrmFinancialSummaries";
import type {
  SnapshotContactReference,
  UnifiedCrmReadContext,
} from "./unifiedCrmReadContextTypes";

// Re-export types for backward compatibility
export type { UnifiedCrmReadContext } from "./unifiedCrmReadContextTypes";

// ── Helpers ───────────────────────────────────────────────────────────

const openQuoteClosedStatuses = new Set([
  "saldato",
  "rifiutato",
  "perso",
  "completato",
]);
const inactiveProjectStatuses = new Set(["completato", "cancellato"]);

const toDateValue = (value?: string | null) => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? Number.NEGATIVE_INFINITY : date.valueOf();
};

const toStartOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const diffDays = (from: Date, to: Date) => {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor(
    (toStartOfDay(to).valueOf() - toStartOfDay(from).valueOf()) / msPerDay,
  );
};

const formatDateTimeLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  });
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
  projectId
    ? projectById.get(String(projectId))?.name ?? "Progetto non trovato"
    : null;

const getSupplierName = (
  supplierById: Map<string, Supplier>,
  supplierId?: Supplier["id"] | null,
) =>
  supplierId
    ? supplierById.get(String(supplierId))?.name ?? "Fornitore non trovato"
    : null;

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
    photoUrl: contact.photo_url ?? null,
  };
};

// ── Main builder ──────────────────────────────────────────────────────

export const buildUnifiedCrmReadContext = ({
  clients,
  contacts,
  quotes,
  projects,
  projectContacts,
  services,
  payments,
  expenses,
  tasks = [],
  workflows = [],
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
  suppliers?: Supplier[];
  tasks?: ClientTask[];
  workflows?: Workflow[];
  semanticRegistry: CrmSemanticRegistry;
  capabilityRegistry: CrmCapabilityRegistry;
  generatedAt?: string;
}): UnifiedCrmReadContext => {
  const allSuppliers = suppliers ?? [];
  const clientById = new Map(clients.map((client) => [String(client.id), client]));
  const supplierById = new Map(allSuppliers.map((s) => [String(s.id), s]));
  const projectById = new Map(
    projects.map((project) => [String(project.id), project]),
  );
  const contactById = new Map(
    contacts.map((contact) => [String(contact.id), contact]),
  );
  const quoteById = new Map(quotes.map((quote) => [String(quote.id), quote]));
  const projectFinancialsById = buildProjectFinancialSummaries({
    projects,
    services,
    payments,
    expenses,
  });
  const paymentsByQuoteId = new Map<string, Payment[]>();
  const servicesByProjectId = new Map<string, Service[]>();
  const contactsByClientId = new Map<string, Contact[]>();
  const projectContactsByProjectId = new Map<string, ProjectContact[]>();
  const projectContactsByContactId = new Map<string, ProjectContact[]>();
  const activeProjectsByClientId = new Map<string, Project[]>();

  services.forEach((service) => {
    if (!service.project_id) return;
    const projectId = String(service.project_id);
    const current = servicesByProjectId.get(projectId) ?? [];
    current.push(service);
    servicesByProjectId.set(projectId, current);
  });

  payments.forEach((payment) => {
    if (!payment.quote_id) return;
    const quoteId = String(payment.quote_id);
    const current = paymentsByQuoteId.get(quoteId) ?? [];
    current.push(payment);
    paymentsByQuoteId.set(quoteId, current);
  });

  contacts.forEach((contact) => {
    if (!contact.client_id) return;
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
    if (!project.client_id) return;
    const clientId = String(project.client_id);
    const current = activeProjectsByClientId.get(clientId) ?? [];
    current.push(project);
    activeProjectsByClientId.set(clientId, current);
  });

  projectContacts.forEach((projectContact) => {
    const projectId = projectContact.project_id ? String(projectContact.project_id) : null;
    const contactId = projectContact.contact_id ? String(projectContact.contact_id) : null;
    if (!projectId || !contactId || !projectById.has(projectId) || !contactById.has(contactId)) return;

    const currentProjectRows = projectContactsByProjectId.get(projectId) ?? [];
    currentProjectRows.push(projectContact);
    projectContactsByProjectId.set(projectId, currentProjectRows);

    const currentContactRows = projectContactsByContactId.get(contactId) ?? [];
    currentContactRows.push(projectContact);
    projectContactsByContactId.set(contactId, currentContactRows);
  });

  const today = toStartOfDay(new Date());
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const pendingPayments = payments
    .filter((payment) => payment.status !== "ricevuto" && payment.payment_type !== "rimborso")
    .sort((left, right) => toDateValue(left.payment_date ?? left.created_at) - toDateValue(right.payment_date ?? right.created_at));
  const overduePayments = pendingPayments.filter((payment) => {
    if (payment.status !== "in_attesa" || !payment.payment_date) return false;
    return toStartOfDay(new Date(payment.payment_date)) < today;
  });
  const incompleteTasks = tasks
    .filter((task) => !task.done_date)
    .sort((left, right) => toDateValue(left.due_date) - toDateValue(right.due_date));
  const upcomingTasks = incompleteTasks.filter((task) => {
    const dueDate = toStartOfDay(new Date(task.due_date));
    return dueDate >= today && dueDate <= nextWeek;
  });
  const overdueTasks = incompleteTasks.filter(
    (task) => toStartOfDay(new Date(task.due_date)) < today,
  );
  const recentExpenses = [...expenses].sort(
    (left, right) => toDateValue(right.expense_date) - toDateValue(left.expense_date),
  );
  const recentClients = [...clients].sort(
    (left, right) => toDateValue(right.created_at) - toDateValue(left.created_at),
  );
  const recentContacts = [...contacts].sort((left, right) => {
    const primaryDelta = Number(isContactPrimaryForClient(right)) - Number(isContactPrimaryForClient(left));
    if (primaryDelta !== 0) return primaryDelta;
    return toDateValue(right.updated_at ?? right.created_at) - toDateValue(left.updated_at ?? left.created_at);
  });

  const openQuotesAmount = openQuotes.reduce((sum, quote) => sum + Number(quote.amount ?? 0), 0);
  const pendingPaymentsAmount = pendingPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const expensesAmount = recentExpenses.reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0);

  const getClientContacts = (clientId: string) =>
    [...(contactsByClientId.get(clientId) ?? [])]
      .sort(compareContactsForClientContext)
      .map((contact) => buildSnapshotContactReference(contact))
      .slice(0, 3);

  const getClientActiveProjects = (clientId: string) =>
    [...(activeProjectsByClientId.get(clientId) ?? [])]
      .sort((left, right) => toDateValue(right.start_date ?? right.created_at) - toDateValue(left.start_date ?? left.created_at))
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
        if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1;
        const leftContact = contactById.get(String(left.contact_id));
        const rightContact = contactById.get(String(right.contact_id));
        if (!leftContact || !rightContact) return 0;
        return compareContactsForClientContext(leftContact, rightContact);
      })
      .flatMap((pc) => {
        const contact = contactById.get(String(pc.contact_id));
        if (!contact) return [];
        return [{ ...buildSnapshotContactReference(contact), isPrimary: pc.is_primary === true }];
      })
      .slice(0, 4);

  const getContactLinkedProjects = (contactId: string) =>
    [...(projectContactsByContactId.get(contactId) ?? [])]
      .sort((left, right) => {
        if (left.is_primary !== right.is_primary) return left.is_primary ? -1 : 1;
        const lp = projectById.get(String(left.project_id));
        const rp = projectById.get(String(right.project_id));
        return toDateValue(rp?.start_date ?? rp?.created_at) - toDateValue(lp?.start_date ?? lp?.created_at);
      })
      .flatMap((pc) => {
        const project = projectById.get(String(pc.project_id));
        if (!project) return [];
        return [{
          projectId: String(project.id),
          projectName: project.name,
          status: project.status,
          statusLabel: projectStatusLabels[project.status] ?? project.status,
          isPrimary: pc.is_primary === true,
        }];
      })
      .slice(0, 4);

  const getPaymentTaxable = (payment: Payment) =>
    isPaymentTaxable(payment, {
      projectServices: payment.project_id ? (servicesByProjectId.get(String(payment.project_id)) ?? []) : [],
      quote: payment.quote_id ? quoteById.get(String(payment.quote_id)) : null,
    });

  return {
    meta: {
      generatedAt,
      generatedAtLabel: formatDateTimeLabel(generatedAt),
      businessTimezone: "Europe/Rome",
      routePrefix: capabilityRegistry.routing.routePrefix,
      scope: "crm_read_snapshot",
    },
    registries: { semantic: semanticRegistry, capability: capabilityRegistry },
    snapshot: {
      counts: {
        clients: clients.length, contacts: contacts.length, suppliers: allSuppliers.length, quotes: quotes.length,
        openQuotes: openQuotes.length, activeProjects: activeProjects.length,
        pendingPayments: pendingPayments.length, overduePayments: overduePayments.length,
        upcomingTasks: upcomingTasks.length, overdueTasks: overdueTasks.length,
        expenses: expenses.length,
      },
      totals: { openQuotesAmount, pendingPaymentsAmount, expensesAmount },
      recentClients: recentClients.map((client) => ({
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
        logoUrl: client.logo_url ?? null,
        contacts: getClientContacts(String(client.id)),
        activeProjects: getClientActiveProjects(String(client.id)),
        createdAt: client.created_at,
      })),
      recentContacts: recentContacts.map((contact) => ({
        ...buildSnapshotContactReference(contact),
        clientId: contact.client_id ? String(contact.client_id) : null,
        clientName: getClientName(clientById, contact.client_id ?? null),
        supplierId: contact.supplier_id ? String(contact.supplier_id) : null,
        supplierName: getSupplierName(supplierById, contact.supplier_id ?? null),
        linkedProjects: getContactLinkedProjects(String(contact.id)),
        updatedAt: contact.updated_at ?? contact.created_at,
      })),
      openQuotes: openQuotes.map((quote) => {
        const ps = buildQuotePaymentsSummary({ quoteAmount: Number(quote.amount ?? 0), payments: paymentsByQuoteId.get(String(quote.id)) ?? [] });
        return {
          quoteId: String(quote.id), clientId: quote.client_id ? String(quote.client_id) : null,
          projectId: quote.project_id ? String(quote.project_id) : null,
          clientName: getClientName(clientById, quote.client_id) ?? "Cliente non trovato",
          projectName: getProjectName(projectById, quote.project_id ?? null),
          amount: Number(quote.amount ?? 0), linkedPaymentsTotal: ps.linkedTotal, remainingAmount: ps.remainingAmount,
          status: quote.status, statusLabel: quoteStatusLabels[quote.status] ?? quote.status, createdAt: quote.created_at,
        };
      }),
      activeProjects: activeProjects.map((project) => {
        const pf = projectFinancialsById.get(String(project.id)) ?? { totalServices: 0, totalFees: 0, totalExpenses: 0, totalPaid: 0, balanceDue: 0 };
        return {
          projectId: String(project.id), clientId: project.client_id ? String(project.client_id) : null,
          projectName: project.name, clientName: getClientName(clientById, project.client_id),
          projectCategory: project.category ?? null, projectTvShow: project.tv_show ?? null,
          status: project.status, statusLabel: projectStatusLabels[project.status] ?? project.status,
          startDate: project.start_date ?? null,
          totalServices: pf.totalServices, totalFees: pf.totalFees, totalExpenses: pf.totalExpenses,
          totalPaid: pf.totalPaid, balanceDue: pf.balanceDue,
          contacts: getProjectContacts(String(project.id)),
          services: (servicesByProjectId.get(String(project.id)) ?? [])
            .sort((left, right) => toDateValue(right.service_date) - toDateValue(left.service_date))
            .slice(0, 20)
            .map((s) => ({
              serviceId: String(s.id),
              serviceType: s.service_type,
              description: s.description ?? null,
              amount: calculateServiceNetValue(s),
              isTaxable: s.is_taxable !== false,
              serviceDate: s.service_date,
              notes: s.notes ?? null,
            })),
        };
      }),
      pendingPayments: pendingPayments.map((payment) => ({
        paymentId: String(payment.id), quoteId: payment.quote_id ? String(payment.quote_id) : null,
        clientId: payment.client_id ? String(payment.client_id) : null, projectId: payment.project_id ? String(payment.project_id) : null,
        clientName: getClientName(clientById, payment.client_id), projectName: getProjectName(projectById, payment.project_id ?? null),
        amount: Number(payment.amount ?? 0), status: payment.status, statusLabel: paymentStatusLabels[payment.status] ?? payment.status,
        paymentDate: payment.payment_date ?? null, isTaxable: getPaymentTaxable(payment),
        proofUrl: payment.proof_url ?? null,
      })),
      overduePayments: overduePayments.map((payment) => ({
        paymentId: String(payment.id), quoteId: payment.quote_id ? String(payment.quote_id) : null,
        clientId: payment.client_id ? String(payment.client_id) : null, projectId: payment.project_id ? String(payment.project_id) : null,
        clientName: getClientName(clientById, payment.client_id), projectName: getProjectName(projectById, payment.project_id ?? null),
        amount: Number(payment.amount ?? 0), status: payment.status, statusLabel: paymentStatusLabels[payment.status] ?? payment.status,
        paymentDate: payment.payment_date ?? null, isTaxable: getPaymentTaxable(payment),
        proofUrl: payment.proof_url ?? null,
        daysOverdue: payment.payment_date ? Math.abs(diffDays(new Date(payment.payment_date), today)) : null,
      })),
      upcomingTasks: upcomingTasks.map((task) => ({
        taskId: String(task.id), clientId: task.client_id ? String(task.client_id) : null,
        clientName: getClientName(clientById, task.client_id ?? null),
        supplierId: task.supplier_id ? String(task.supplier_id) : null,
        supplierName: getSupplierName(supplierById, task.supplier_id ?? null),
        text: task.text, type: task.type, dueDate: task.due_date, allDay: task.all_day,
        daysUntilDue: diffDays(today, new Date(task.due_date)),
      })),
      overdueTasks: overdueTasks.map((task) => ({
        taskId: String(task.id), clientId: task.client_id ? String(task.client_id) : null,
        clientName: getClientName(clientById, task.client_id ?? null),
        supplierId: task.supplier_id ? String(task.supplier_id) : null,
        supplierName: getSupplierName(supplierById, task.supplier_id ?? null),
        text: task.text, type: task.type, dueDate: task.due_date, allDay: task.all_day,
        daysOverdue: Math.abs(diffDays(new Date(task.due_date), today)),
      })),
      recentExpenses: recentExpenses.map((expense) => ({
        expenseId: String(expense.id), clientId: expense.client_id ? String(expense.client_id) : null,
        projectId: expense.project_id ? String(expense.project_id) : null,
        supplierId: expense.supplier_id ? String(expense.supplier_id) : null,
        clientName: getClientName(clientById, expense.client_id ?? null),
        projectName: getProjectName(projectById, expense.project_id ?? null),
        supplierName: getSupplierName(supplierById, expense.supplier_id ?? null),
        amount: Number(expense.amount ?? 0), expenseType: expense.expense_type,
        expenseTypeLabel: expenseTypeLabels[expense.expense_type] ?? expense.expense_type,
        expenseDate: expense.expense_date, description: expense.description ?? null,
        proofUrl: expense.proof_url ?? null,
      })),
      clientLevelServices: services
        .filter((s) => !s.project_id && s.client_id)
        .map((s) => ({
          serviceId: String(s.id), clientId: s.client_id ? String(s.client_id) : null,
          clientName: getClientName(clientById, s.client_id ?? null),
          serviceType: s.service_type, description: s.description ?? null, amount: calculateServiceNetValue(s),
          isTaxable: s.is_taxable !== false, serviceDate: s.service_date, notes: s.notes ?? null,
        })),
      recentSuppliers: [...allSuppliers]
        .sort((a, b) => toDateValue(b.created_at) - toDateValue(a.created_at))
        .map((s) => ({
          supplierId: String(s.id),
          supplierName: s.name,
          vatNumber: s.vat_number ?? null,
          fiscalCode: s.fiscal_code ?? null,
          email: s.email ?? null,
          phone: s.phone ?? null,
          defaultExpenseType: s.default_expense_type ?? null,
          defaultExpenseTypeLabel: s.default_expense_type
            ? (expenseTypeLabels[s.default_expense_type] ?? s.default_expense_type)
            : null,
          logoUrl: s.logo_url ?? null,
          createdAt: s.created_at,
        })),
      clientFinancials: buildClientFinancialSummaries({ services, payments, clientById }),
      supplierFinancials: buildSupplierFinancialSummaries({ expenses, supplierById }),
      activeWorkflows: workflows
        .filter((wf) => wf.is_active)
        .map((wf) => ({
          workflowId: String(wf.id),
          name: wf.name,
          description: wf.description ?? null,
          triggerResource: wf.trigger_resource,
          triggerResourceLabel: triggerResourceLabels[wf.trigger_resource] ?? wf.trigger_resource,
          triggerEvent: wf.trigger_event,
          triggerEventLabel: triggerEventLabels[wf.trigger_event] ?? wf.trigger_event,
          conditionsSummary: describeConditions(wf.trigger_resource, wf.trigger_conditions),
          actionsSummary: wf.actions.map((a) => describeAction(a)).join("; "),
          isActive: true,
        })),
    },
    caveats: [
      "Questo snapshot e' read-only: nessuna scrittura nel CRM parte da questo contesto o dalle risposte AI che lo usano senza una conferma esplicita in un workflow dedicato.",
      "I significati di stati, tipi, formule e route vanno letti dai registri semantico e capability inclusi nel contesto.",
      "Le liste recenti sono intenzionalmente limitate ai record piu utili per lettura rapida nel launcher unificato, ma ora espongono anche relazioni strutturate cliente-progetto-referente e i singoli servizi per progetto (max 20) gia presenti nel CRM.",
      "Ogni servizio ha un campo description (titolo breve identificativo) distinto da notes (annotazioni operative): usare description per nominare il servizio e notes per dettagli aggiuntivi.",
    ],
  };
};
