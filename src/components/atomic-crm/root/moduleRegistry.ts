import {
  Briefcase,
  Building2,
  CreditCard,
  FileText,
  FolderOpen,
  ListTodo,
  type LucideIcon,
  Receipt,
  User,
  Users,
  Workflow,
} from "lucide-react";
import type { ComponentType } from "react";
import type { RaRecord } from "ra-core";

import clients from "../clients";
import contacts from "../contacts";
import expenses from "../expenses";
import payments from "../payments";
import projects from "../projects";
import quotes from "../quotes";
import services from "../services";
import suppliers from "../suppliers";
import { PaymentOverdueBadge } from "../payments/PaymentOverdueBadge";
import { MobileTasksList } from "../tasks/MobileTasksList";
import { TasksList } from "../tasks/TasksList";
import * as workflows from "../workflows";

export type CrmModuleDefinition = {
  resource: string;
  label: string;
  icon?: LucideIcon;
  iconColor?: string;
  path: string;
  components: {
    list?: ComponentType;
    show?: ComponentType;
    edit?: ComponentType;
    create?: ComponentType;
    mobileList?: ComponentType;
    recordRepresentation?: ((record: unknown) => string) | string;
  };
  nav: {
    desktop: {
      header: boolean;
      headerOrder: number;
    };
    mobile: {
      bottomBar: boolean;
      bottomBarOrder: number;
      altroMenu: boolean;
      altroMenuOrder: number;
      createMenu: boolean;
      createMenuAction?: "navigate" | "sheet";
      createMenuOrder?: number;
    };
  };
  ai?: {
    label: string;
    description: string;
    routePatterns: string[];
    supportedViews: Array<"list" | "show" | "create" | "edit">;
  };
  badge?: ComponentType;
  headless?: boolean;
  enabled?: boolean;
};

const toResourceComponents = (value: unknown) =>
  value as CrmModuleDefinition["components"];

export const crmModules: CrmModuleDefinition[] = [
  {
    resource: "clients",
    label: "Clienti",
    icon: Users,
    iconColor: "text-blue-500",
    path: "/clients",
    components: toResourceComponents(clients),
    nav: {
      desktop: { header: true, headerOrder: 10 },
      mobile: {
        bottomBar: true,
        bottomBarOrder: 10,
        altroMenu: false,
        altroMenuOrder: 0,
        createMenu: false,
      },
    },
    ai: {
      label: "Clienti",
      description:
        "Anagrafica clienti e punto di partenza per lavoro operativo, fatturazione interna e incassi semplici.",
      routePatterns: [
        "/#/clients",
        "/#/clients/create",
        "/#/clients/:id",
        "/#/clients/:id/show",
      ],
      supportedViews: ["list", "show", "create", "edit"],
    },
  },
  {
    resource: "contacts",
    label: "Referenti",
    icon: User,
    iconColor: "text-cyan-500",
    path: "/contacts",
    components: toResourceComponents(contacts),
    nav: {
      desktop: { header: true, headerOrder: 20 },
      mobile: {
        bottomBar: false,
        bottomBarOrder: 0,
        altroMenu: true,
        altroMenuOrder: 10,
        createMenu: false,
      },
    },
    ai: {
      label: "Referenti",
      description:
        "Persone collegate ai clienti e, tramite project_contacts, ai progetti da seguire sul piano operativo.",
      routePatterns: [
        "/#/contacts",
        "/#/contacts/create",
        "/#/contacts/:id",
        "/#/contacts/:id/show",
      ],
      supportedViews: ["list", "show", "create", "edit"],
    },
  },
  {
    resource: "projects",
    label: "Progetti",
    icon: FolderOpen,
    iconColor: "text-amber-500",
    path: "/projects",
    components: toResourceComponents(projects),
    nav: {
      desktop: { header: true, headerOrder: 30 },
      mobile: {
        bottomBar: false,
        bottomBarOrder: 0,
        altroMenu: true,
        altroMenuOrder: 20,
        createMenu: false,
      },
    },
    ai: {
      label: "Progetti",
      description:
        "Contenitore operativo dei lavori strutturati, con legami verso referenti, servizi, spese e incassi.",
      routePatterns: [
        "/#/projects",
        "/#/projects/create",
        "/#/projects/:id",
        "/#/projects/:id/show",
      ],
      supportedViews: ["list", "show", "create", "edit"],
    },
  },
  {
    resource: "services",
    label: "Registro Lavori",
    icon: Briefcase,
    iconColor: "text-indigo-500",
    path: "/services",
    components: toResourceComponents(services),
    nav: {
      desktop: { header: true, headerOrder: 40 },
      mobile: {
        bottomBar: false,
        bottomBarOrder: 0,
        altroMenu: true,
        altroMenuOrder: 30,
        createMenu: true,
        createMenuAction: "navigate",
        createMenuOrder: 20,
      },
    },
    ai: {
      label: "Servizi",
      description:
        "Registro lavori con compensi, km, tassabilita' e date operative utili a stimare valore e carico fiscale.",
      routePatterns: [
        "/#/services",
        "/#/services/create",
        "/#/services/:id",
        "/#/services/:id/show",
      ],
      supportedViews: ["list", "show", "create", "edit"],
    },
  },
  {
    resource: "quotes",
    label: "Preventivi",
    icon: FileText,
    iconColor: "text-violet-500",
    path: "/quotes",
    components: toResourceComponents(quotes),
    nav: {
      desktop: { header: true, headerOrder: 50 },
      mobile: {
        bottomBar: false,
        bottomBarOrder: 0,
        altroMenu: true,
        altroMenuOrder: 40,
        createMenu: false,
      },
    },
    ai: {
      label: "Preventivi",
      description:
        "Pipeline commerciale, importi proposti, stati, PDF e link a progetto o pagamento nel flusso operativo.",
      routePatterns: [
        "/#/quotes",
        "/#/quotes/create",
        "/#/quotes/:id",
        "/#/quotes/:id/show",
      ],
      supportedViews: ["list", "show", "create", "edit"],
    },
  },
  {
    resource: "payments",
    label: "Pagamenti",
    icon: CreditCard,
    iconColor: "text-green-500",
    path: "/payments",
    components: toResourceComponents(payments),
    nav: {
      desktop: { header: true, headerOrder: 60 },
      mobile: {
        bottomBar: false,
        bottomBarOrder: 0,
        altroMenu: true,
        altroMenuOrder: 50,
        createMenu: true,
        createMenuAction: "navigate",
        createMenuOrder: 30,
      },
    },
    ai: {
      label: "Pagamenti",
      description:
        "Incassi ricevuti o attesi collegati a cliente, progetto o preventivo con focus su scadenze e follow-up.",
      routePatterns: [
        "/#/payments",
        "/#/payments/create",
        "/#/payments/:id",
        "/#/payments/:id/show",
      ],
      supportedViews: ["list", "show", "create", "edit"],
    },
    badge: PaymentOverdueBadge,
  },
  {
    resource: "expenses",
    label: "Spese",
    icon: Receipt,
    iconColor: "text-orange-500",
    path: "/expenses",
    components: toResourceComponents(expenses),
    nav: {
      desktop: { header: true, headerOrder: 70 },
      mobile: {
        bottomBar: false,
        bottomBarOrder: 0,
        altroMenu: true,
        altroMenuOrder: 60,
        createMenu: true,
        createMenuAction: "navigate",
        createMenuOrder: 10,
      },
    },
    ai: {
      label: "Spese",
      description:
        "Spese operative, crediti ricevuti e rimborsi km da tenere coerenti con clienti, progetti e margini.",
      routePatterns: [
        "/#/expenses",
        "/#/expenses/create",
        "/#/expenses/:id",
        "/#/expenses/:id/show",
      ],
      supportedViews: ["list", "show", "create", "edit"],
    },
  },
  {
    resource: "suppliers",
    label: "Fornitori",
    icon: Building2,
    iconColor: "text-indigo-500",
    path: "/suppliers",
    components: toResourceComponents(suppliers),
    nav: {
      desktop: { header: true, headerOrder: 15 },
      mobile: {
        bottomBar: false,
        bottomBarOrder: 0,
        altroMenu: true,
        altroMenuOrder: 65,
        createMenu: false,
      },
    },
    ai: {
      label: "Fornitori",
      description:
        "Anagrafica fornitori con dati fiscali e di fatturazione, collegati alle spese per tracciare la controparte.",
      routePatterns: [
        "/#/suppliers",
        "/#/suppliers/create",
        "/#/suppliers/:id",
        "/#/suppliers/:id/show",
      ],
      supportedViews: ["list", "show", "create", "edit"],
    },
  },
  {
    resource: "client_tasks",
    label: "Promemoria",
    icon: ListTodo,
    iconColor: "text-rose-500",
    path: "/client_tasks",
    components: {
      list: TasksList,
      mobileList: MobileTasksList,
      recordRepresentation: (record: unknown) => {
        const typedRecord = record as RaRecord & { text?: string };
        return typedRecord?.text ?? "Promemoria";
      },
    },
    nav: {
      desktop: { header: true, headerOrder: 80 },
      mobile: {
        bottomBar: true,
        bottomBarOrder: 20,
        altroMenu: false,
        altroMenuOrder: 0,
        createMenu: true,
        createMenuAction: "sheet",
        createMenuOrder: 40,
      },
    },
    ai: {
      label: "Promemoria",
      description:
        "Follow-up e attivita' a scadenza collegati ai clienti per non perdere prossime azioni operative.",
      routePatterns: ["/#/client_tasks"],
      supportedViews: ["list"],
    },
  },
  {
    resource: "workflows",
    label: "Automazioni",
    icon: Workflow,
    path: "/workflows",
    components: {
      list: workflows.WorkflowList,
      show: workflows.WorkflowShow,
      edit: workflows.WorkflowEdit,
      create: workflows.WorkflowCreate,
      recordRepresentation: (record: unknown) => {
        const typedRecord = record as RaRecord & { name?: string };
        return typedRecord?.name ?? "Workflow";
      },
    },
    nav: {
      desktop: { header: false, headerOrder: 0 },
      mobile: {
        bottomBar: false,
        bottomBarOrder: 0,
        altroMenu: false,
        altroMenuOrder: 0,
        createMenu: false,
      },
    },
    ai: {
      label: "Automazioni",
      description:
        "Regole di automazione che eseguono azioni (promemoria, email, notifiche, creazione progetto) quando un evento CRM avviene su progetti, preventivi, pagamenti o promemoria.",
      routePatterns: [
        "/#/workflows",
        "/#/workflows/create",
        "/#/workflows/:id/show",
        "/#/workflows/:id",
      ],
      supportedViews: ["list", "show", "create", "edit"],
    },
  },
  {
    resource: "workflow_executions",
    label: "Esecuzioni workflow",
    path: "/workflow_executions",
    components: {},
    nav: {
      desktop: { header: false, headerOrder: 0 },
      mobile: {
        bottomBar: false,
        bottomBarOrder: 0,
        altroMenu: false,
        altroMenuOrder: 0,
        createMenu: false,
      },
    },
    headless: true,
  },
  {
    resource: "invoicing",
    label: "Fatturazione bozze",
    path: "/invoicing",
    components: {},
    nav: {
      desktop: { header: false, headerOrder: 0 },
      mobile: {
        bottomBar: false,
        bottomBarOrder: 0,
        altroMenu: false,
        altroMenuOrder: 0,
        createMenu: false,
      },
    },
    ai: {
      label: "Bozze fattura",
      description:
        "Genera bozze fattura di riferimento per Aruba da servizi, progetti, clienti o preventivi senza creare documenti fiscali.",
      routePatterns: [],
      supportedViews: [],
    },
    headless: true,
  },
  {
    resource: "client_notes",
    label: "Note cliente",
    path: "/client_notes",
    components: {},
    nav: {
      desktop: { header: false, headerOrder: 0 },
      mobile: {
        bottomBar: false,
        bottomBarOrder: 0,
        altroMenu: false,
        altroMenuOrder: 0,
        createMenu: false,
      },
    },
    headless: true,
  },
  {
    resource: "project_contacts",
    label: "Collegamenti referenti-progetti",
    path: "/project_contacts",
    components: {},
    nav: {
      desktop: { header: false, headerOrder: 0 },
      mobile: {
        bottomBar: false,
        bottomBarOrder: 0,
        altroMenu: false,
        altroMenuOrder: 0,
        createMenu: false,
      },
    },
    headless: true,
  },
  {
    resource: "sales",
    label: "Utenti commerciali",
    path: "/sales",
    components: {},
    nav: {
      desktop: { header: false, headerOrder: 0 },
      mobile: {
        bottomBar: false,
        bottomBarOrder: 0,
        altroMenu: false,
        altroMenuOrder: 0,
        createMenu: false,
      },
    },
    headless: true,
  },
  {
    resource: "tags",
    label: "Etichette",
    path: "/tags",
    components: {},
    nav: {
      desktop: { header: false, headerOrder: 0 },
      mobile: {
        bottomBar: false,
        bottomBarOrder: 0,
        altroMenu: false,
        altroMenuOrder: 0,
        createMenu: false,
      },
    },
    headless: true,
  },
];

const isEnabled = (module: CrmModuleDefinition) => module.enabled !== false;

const getSortedBy = <T extends CrmModuleDefinition>(
  modules: T[],
  selector: (module: T) => number,
) => [...modules].sort((left, right) => selector(left) - selector(right));

export const getEnabledModules = () => crmModules.filter(isEnabled);

export const getPageModules = () =>
  getEnabledModules().filter((module) => !module.headless);

export const getDesktopHeaderModules = () =>
  getSortedBy(
    getPageModules().filter((module) => module.nav.desktop.header),
    (module) => module.nav.desktop.headerOrder,
  );

export const getMobileBottomBarModules = () =>
  getSortedBy(
    getPageModules().filter((module) => module.nav.mobile.bottomBar),
    (module) => module.nav.mobile.bottomBarOrder,
  );

export const getMobileAltroModules = () =>
  getSortedBy(
    getPageModules().filter((module) => module.nav.mobile.altroMenu),
    (module) => module.nav.mobile.altroMenuOrder,
  );

export const getMobileCreateModules = () =>
  getSortedBy(
    getPageModules().filter((module) => module.nav.mobile.createMenu),
    (module) => module.nav.mobile.createMenuOrder ?? Number.MAX_SAFE_INTEGER,
  );

export const getAiResourceModules = () =>
  getEnabledModules().filter(
    (
      module,
    ): module is CrmModuleDefinition & {
      ai: NonNullable<CrmModuleDefinition["ai"]>;
    } => Boolean(module.ai),
  );

export const getModuleByResource = (resource: string) =>
  crmModules.find((module) => module.resource === resource);
