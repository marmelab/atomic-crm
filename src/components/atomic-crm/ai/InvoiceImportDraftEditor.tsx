import { Trash2 } from "lucide-react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getInvoiceImportRecordValidationErrors,
  type InvoiceImportDraft,
  type InvoiceImportRecordDraft,
  type InvoiceImportWorkspace,
} from "@/lib/ai/invoiceImport";
import { buildClientCreatePathFromInvoiceDraft } from "../clients/clientLinking";
import { getClientInvoiceWorkspaceLabel } from "../clients/clientBilling";
import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  confidenceTone,
  hasBillingProfileDraft,
  resourceLabels,
} from "./invoiceImportDraftHelpers";
import { Field, Section, SelectField } from "./InvoiceImportDraftPrimitives";
import { InvoiceImportDraftBillingSection } from "./InvoiceImportDraftBillingSection";
import { InvoiceImportDraftExpenseSection } from "./InvoiceImportDraftExpenseSection";
import { InvoiceImportDraftPaymentSection } from "./InvoiceImportDraftPaymentSection";
import { InvoiceImportDraftServiceSection } from "./InvoiceImportDraftServiceSection";

export const InvoiceImportDraftEditor = ({
  draft,
  workspace,
  onChange,
  onRemove,
}: {
  draft: InvoiceImportDraft;
  workspace: InvoiceImportWorkspace;
  onChange: (index: number, patch: Partial<InvoiceImportRecordDraft>) => void;
  onRemove: (index: number) => void;
}) => {
  const { serviceTypeChoices, operationalConfig } = useConfigurationContext();

  return (
    <div className="space-y-4">
      {draft.records.map((record, index) => {
        const missingFields = getInvoiceImportRecordValidationErrors(
          record,
          workspace,
        );

        return (
          <div
            key={record.id}
            className="rounded-2xl border bg-background/90 p-4 shadow-sm space-y-5"
          >
            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {resourceLabels[record.resource]}
                  </Badge>
                  <Badge variant={confidenceTone[record.confidence]}>
                    Confidenza {record.confidence}
                  </Badge>
                  <Badge variant="outline">{record.documentType}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {record.sourceFileNames.join(", ") || "File non indicato"}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemove(index)}
                aria-label={`Escludi record ${index + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            {record.rationale ? (
              <p className="text-sm text-muted-foreground">
                {record.rationale}
              </p>
            ) : null}

            {missingFields.length > 0 ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Prima di confermare manca: {missingFields.join(", ")}.
              </div>
            ) : null}

            {/* ── Documento ── */}
            <Section title="Documento" color="slate">
              <Field label="Tipo record">
                <SelectField
                  value={record.resource}
                  onChange={(value) =>
                    onChange(index, {
                      resource: value as "payments" | "expenses" | "services",
                    })
                  }
                >
                  <option value="payments">Pagamento</option>
                  <option value="expenses">Spesa</option>
                  <option value="services">Servizio</option>
                </SelectField>
              </Field>

              <Field label="Controparte">
                <Input
                  value={record.counterpartyName ?? ""}
                  onChange={(event) =>
                    onChange(index, { counterpartyName: event.target.value })
                  }
                />
              </Field>

              <Field label="Importo (EUR)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={record.amount ?? ""}
                  onChange={(event) =>
                    onChange(index, {
                      amount:
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                    })
                  }
                />
              </Field>

              <Field label={record.resource === "services" ? "Data servizio" : "Data documento"}>
                <Input
                  type="date"
                  value={record.documentDate ?? ""}
                  onChange={(event) =>
                    onChange(index, { documentDate: event.target.value })
                  }
                />
              </Field>

              <Field label="Scadenza">
                <Input
                  type="date"
                  value={record.dueDate ?? ""}
                  onChange={(event) =>
                    onChange(index, { dueDate: event.target.value })
                  }
                />
              </Field>

              <Field label="Rif. fattura">
                <Input
                  value={record.invoiceRef ?? ""}
                  onChange={(event) =>
                    onChange(index, { invoiceRef: event.target.value })
                  }
                />
              </Field>
            </Section>

            {/* ── Collegamento CRM ── */}
            <Section title="Collegamento CRM" color="indigo">
              <Field label="Cliente">
                <SelectField
                  value={String(record.clientId ?? "")}
                  onChange={(value) => {
                    const nextClientId = value || null;
                    const hasMatchingProject =
                      !record.projectId ||
                      workspace.projects.some(
                        (project) =>
                          project.id === record.projectId &&
                          String(project.client_id) === String(nextClientId),
                      );

                    onChange(index, {
                      clientId: nextClientId,
                      projectId: hasMatchingProject
                        ? (record.projectId ?? null)
                        : null,
                    });
                  }}
                >
                  <option value="">Seleziona cliente</option>
                  {workspace.clients.map((client) => (
                    <option key={client.id} value={String(client.id)}>
                      {getClientInvoiceWorkspaceLabel(client)}
                    </option>
                  ))}
                </SelectField>
              </Field>

              <Field label="Progetto">
                <SelectField
                  value={String(record.projectId ?? "")}
                  onChange={(value) => {
                    const nextProject =
                      workspace.projects.find(
                        (project) => String(project.id) === value,
                      ) ?? null;

                    onChange(index, {
                      projectId: nextProject?.id ?? null,
                      clientId:
                        nextProject?.client_id ?? record.clientId ?? null,
                    });
                  }}
                >
                  <option value="">Nessun progetto</option>
                  {workspace.projects
                    .filter(
                      (project) =>
                        !record.clientId ||
                        String(project.client_id) === String(record.clientId),
                    )
                    .map((project) => (
                      <option key={project.id} value={String(project.id)}>
                        {project.name}
                      </option>
                    ))}
                </SelectField>
              </Field>

              {!record.clientId &&
              (record.resource === "payments" ||
                record.resource === "services" ||
                hasBillingProfileDraft(record) ||
                record.counterpartyName) ? (
                <div className="md:col-span-2">
                  <Button asChild type="button" variant="outline" size="sm">
                    <Link
                      to={buildClientCreatePathFromInvoiceDraft({ record })}
                    >
                      Apri nuovo cliente precompilato
                    </Link>
                  </Button>
                </div>
              ) : null}
            </Section>

            {/* ── Dettagli specifici per resource ── */}
            {record.resource === "payments" ? (
              <InvoiceImportDraftPaymentSection
                record={record}
                onChange={(patch) => onChange(index, patch)}
              />
            ) : record.resource === "services" ? (
              <InvoiceImportDraftServiceSection
                record={record}
                serviceTypeChoices={serviceTypeChoices}
                defaultKmRate={operationalConfig.defaultKmRate ?? 0}
                defaultTravelOrigin={operationalConfig.defaultTravelOrigin}
                onChange={(patch) => onChange(index, patch)}
              />
            ) : (
              <InvoiceImportDraftExpenseSection
                record={record}
                onChange={(patch) => onChange(index, patch)}
              />
            )}

            {/* ── Anagrafica fiscale ── */}
            <InvoiceImportDraftBillingSection
              record={record}
              onChange={(patch) => onChange(index, patch)}
            />

            {/* ── Note ── */}
            <Section title="Note" color="slate">
              <Field label="Note import" className="md:col-span-2">
                <Textarea
                  value={record.notes ?? ""}
                  onChange={(event) =>
                    onChange(index, { notes: event.target.value })
                  }
                  className="min-h-20"
                />
              </Field>
            </Section>
          </div>
        );
      })}
    </div>
  );
};
