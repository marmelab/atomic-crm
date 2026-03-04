import {
  FolderOpen,
  FileText,
  Banknote,
  Bell,
  ClipboardList,
  PenLine,
  type LucideIcon,
} from "lucide-react";
import type { WorkflowAction } from "../types";

// ─── Icons & Colors ─────────────────────────────────────────────────────────

export const triggerResourceIcons: Record<string, LucideIcon> = {
  projects: FolderOpen,
  quotes: FileText,
  payments: Banknote,
  client_tasks: Bell,
};

export const triggerResourceColors: Record<string, string> = {
  projects: "text-blue-600 bg-blue-100/80 dark:text-blue-400 dark:bg-blue-950",
  quotes:
    "text-amber-600 bg-amber-100/80 dark:text-amber-400 dark:bg-amber-950",
  payments:
    "text-emerald-600 bg-emerald-100/80 dark:text-emerald-400 dark:bg-emerald-950",
  client_tasks:
    "text-violet-600 bg-violet-100/80 dark:text-violet-400 dark:bg-violet-950",
};

export const actionTypeIcons: Record<string, LucideIcon> = {
  create_task: Bell,
  create_project: ClipboardList,
  update_field: PenLine,
};

// ─── Labels ──────────────────────────────────────────────────────────────────

export const triggerResourceLabels: Record<string, string> = {
  projects: "Progetti",
  quotes: "Preventivi",
  payments: "Pagamenti",
  client_tasks: "Promemoria",
};

/** Singular forms for sentence building */
const triggerResourceSingular: Record<string, string> = {
  projects: "un progetto",
  quotes: "un preventivo",
  payments: "un pagamento",
  client_tasks: "un promemoria",
};

export const triggerEventLabels: Record<string, string> = {
  created: "Creato",
  updated: "Modificato",
  status_changed: "Cambio stato",
};

/** Verb forms for sentence building */
const triggerEventVerbs: Record<string, string> = {
  created: "viene creato",
  updated: "viene modificato",
  status_changed: "cambia stato",
};

export const actionTypeLabels: Record<string, string> = {
  create_task: "Crea promemoria",
  create_project: "Crea progetto",
  update_field: "Aggiorna campo",
};

// ─── Status choices per resource (for smart condition builder) ────────────────

export const statusChoicesForResource: Record<
  string,
  { value: string; label: string }[]
> = {
  projects: [
    { value: "in_corso", label: "In corso" },
    { value: "completato", label: "Completato" },
    { value: "in_pausa", label: "In pausa" },
    { value: "cancellato", label: "Cancellato" },
  ],
  quotes: [
    { value: "primo_contatto", label: "Primo contatto" },
    { value: "preventivo_inviato", label: "Preventivo inviato" },
    { value: "in_trattativa", label: "In trattativa" },
    { value: "accettato", label: "Accettato" },
    { value: "acconto_ricevuto", label: "Acconto ricevuto" },
    { value: "in_lavorazione", label: "In lavorazione" },
    { value: "completato", label: "Completato" },
    { value: "saldato", label: "Saldato" },
    { value: "rifiutato", label: "Rifiutato" },
    { value: "perso", label: "Perso" },
  ],
  payments: [
    { value: "ricevuto", label: "Ricevuto" },
    { value: "in_attesa", label: "In attesa" },
    { value: "scaduto", label: "Scaduto" },
  ],
};

/** Resolve a status value to its Italian label */
export const getStatusLabel = (
  resource: string,
  statusValue: string,
): string => {
  const choices = statusChoicesForResource[resource];
  return choices?.find((c) => c.value === statusValue)?.label ?? statusValue;
};

// ─── Choices for SelectInput components ──────────────────────────────────────

export const triggerResourceChoices = Object.entries(triggerResourceLabels).map(
  ([value, label]) => ({ value, label }),
);

export const triggerEventChoices = Object.entries(triggerEventLabels).map(
  ([value, label]) => ({ value, label }),
);

export const actionTypeChoices = Object.entries(actionTypeLabels).map(
  ([value, label]) => ({ value, label }),
);

// ─── Human-readable descriptions ─────────────────────────────────────────────

/** Describe conditions in natural language */
export const describeConditions = (
  resource: string,
  conditions: Record<string, unknown> | undefined,
): string | null => {
  if (!conditions || Object.keys(conditions).length === 0) return null;

  if (conditions.status) {
    const label = getStatusLabel(resource, String(conditions.status));
    return `in "${label}"`;
  }

  return Object.entries(conditions)
    .map(([key, value]) => `${key} = ${value}`)
    .join(", ");
};

/** Describe a single action in natural language */
export const describeAction = (action: WorkflowAction): string => {
  const d = action.data ?? {};
  switch (action.type) {
    case "create_task": {
      const text = d.text ? `"${d.text}"` : "automatico";
      const days = d.due_days ? ` (scadenza ${d.due_days} giorni)` : "";
      return `Crea promemoria: ${text}${days}`;
    }
    case "create_project":
      return "Crea un nuovo progetto dal preventivo";
    case "update_field":
      return `Imposta ${d.field ?? "campo"} = ${d.value ?? "valore"}`;
    default:
      return actionTypeLabels[action.type] ?? action.type;
  }
};

/** Full human-readable workflow sentence */
export const describeWorkflow = (
  triggerResource: string,
  triggerEvent: string,
  conditions: Record<string, unknown>,
  actions: { type: string; data?: Record<string, unknown> }[],
): string => {
  const resource = triggerResourceSingular[triggerResource] || triggerResource;
  const verb = triggerEventVerbs[triggerEvent] || triggerEvent;
  const conditionStr = describeConditions(triggerResource, conditions);
  const conditionPart = conditionStr ? ` ${conditionStr}` : "";

  const actionStr = actions
    .map((a) => actionTypeLabels[a.type] || a.type)
    .join(", ");

  return `Quando ${resource} ${verb}${conditionPart} → ${actionStr}`;
};
