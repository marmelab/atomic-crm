/**
 * Resolve template placeholders in workflow notification strings.
 *
 * Supported placeholders:
 *   {nome_cliente}   — client.name
 *   {email_cliente}  — client.email
 *   {risorsa}        — trigger resource label (Italian)
 *   {stato}          — record.status
 *   {nome_progetto}  — record.name (projects) or project name
 *   {importo}        — record.amount formatted as EUR
 *   {data}           — current date DD/MM/YYYY
 */

interface TemplateContext {
  client?: Record<string, unknown> | null;
  record: Record<string, unknown>;
  resource: string;
}

const resourceLabels: Record<string, string> = {
  projects: "Progetto",
  quotes: "Preventivo",
  payments: "Pagamento",
  client_tasks: "Promemoria",
  services: "Servizio",
  clients: "Cliente",
  expenses: "Spesa",
};

const formatCurrency = (value: unknown): string => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });
};

import { BUSINESS_TIMEZONE } from "./dateTimezone.ts";

const formatDate = (): string => {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: BUSINESS_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
};

export function resolveTemplatePlaceholders(
  template: string,
  ctx: TemplateContext,
): string {
  const replacements: Record<string, string> = {
    "{nome_cliente}": ctx.client
      ? String(ctx.client.name ?? ctx.client.first_name ?? "")
      : "",
    "{email_cliente}": ctx.client ? String(ctx.client.email ?? "") : "",
    "{risorsa}": resourceLabels[ctx.resource] ?? ctx.resource,
    "{stato}": String(ctx.record.status ?? ""),
    "{nome_progetto}": String(ctx.record.name ?? ""),
    "{importo}":
      ctx.record.amount != null ? formatCurrency(ctx.record.amount) : "",
    "{data}": formatDate(),
  };

  let result = template;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replaceAll(placeholder, value);
  }
  return result;
}
