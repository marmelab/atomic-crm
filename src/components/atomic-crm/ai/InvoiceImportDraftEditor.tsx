import { Trash2 } from "lucide-react";
import { Link } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  getInvoiceImportRecordValidationErrors,
  type InvoiceImportDraft,
  type InvoiceImportRecordDraft,
  type InvoiceImportWorkspace,
} from "@/lib/ai/invoiceImport";
import { TravelRouteCalculatorDialog } from "../travel/TravelRouteCalculatorDialog";
import {
  expenseTypeChoices,
  expenseTypeLabels,
} from "../expenses/expenseTypes";
import { buildClientCreatePathFromInvoiceDraft } from "../clients/clientLinking";
import { getClientInvoiceWorkspaceLabel } from "../clients/clientBilling";
import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  paymentMethodChoices,
  paymentStatusChoices,
  paymentTypeChoices,
} from "../payments/paymentTypes";

const confidenceTone: Record<
  InvoiceImportRecordDraft["confidence"],
  "default" | "secondary" | "outline"
> = {
  high: "default",
  medium: "secondary",
  low: "outline",
};

const resourceLabels = {
  payments: "Pagamento",
  expenses: "Spesa",
  services: "Servizio",
};

const hasBillingProfileDraft = (record: InvoiceImportRecordDraft) =>
  [
    record.billingName,
    record.vatNumber,
    record.fiscalCode,
    record.billingAddressStreet,
    record.billingAddressNumber,
    record.billingPostalCode,
    record.billingCity,
    record.billingProvince,
    record.billingCountry,
    record.billingSdiCode,
    record.billingPec,
  ].some((value) => value?.trim());

const Field = ({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("space-y-2", className)}>
    <Label>{label}</Label>
    {children}
  </div>
);

const SelectField = ({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className="border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
  >
    {children}
  </select>
);

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
            className="rounded-2xl border bg-background/90 p-4 shadow-sm"
          >
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
              <p className="mt-3 text-sm text-muted-foreground">
                {record.rationale}
              </p>
            ) : null}

            {missingFields.length > 0 ? (
              <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Prima di confermare manca: {missingFields.join(", ")}.
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
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

              <Field label="Controparte letta dal documento">
                <Input
                  value={record.counterpartyName ?? ""}
                  onChange={(event) =>
                    onChange(index, { counterpartyName: event.target.value })
                  }
                />
              </Field>

              <Field label="Denominazione fiscale">
                <Input
                  value={record.billingName ?? ""}
                  onChange={(event) =>
                    onChange(index, { billingName: event.target.value })
                  }
                />
              </Field>

              <Field label="Partita IVA">
                <Input
                  value={record.vatNumber ?? ""}
                  onChange={(event) =>
                    onChange(index, { vatNumber: event.target.value })
                  }
                />
              </Field>

              <Field label="Codice fiscale">
                <Input
                  value={record.fiscalCode ?? ""}
                  onChange={(event) =>
                    onChange(index, { fiscalCode: event.target.value })
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

              <Field label="Data documento">
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

              <Field label="Cliente CRM">
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

              {!record.clientId &&
              (record.resource === "payments" ||
                record.resource === "services" ||
                hasBillingProfileDraft(record) ||
                record.counterpartyName) ? (
                <div className="md:col-span-2">
                  <Button asChild type="button" variant="outline">
                    <Link
                      to={buildClientCreatePathFromInvoiceDraft({ record })}
                    >
                      Apri nuovo cliente precompilato
                    </Link>
                  </Button>
                </div>
              ) : null}

              <Field label="Progetto CRM">
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

              {record.resource === "payments" ? (
                <>
                  <Field label="Tipo pagamento">
                    <SelectField
                      value={record.paymentType ?? "saldo"}
                      onChange={(value) =>
                        onChange(index, {
                          paymentType:
                            value as InvoiceImportRecordDraft["paymentType"],
                        })
                      }
                    >
                      {paymentTypeChoices.map((choice) => (
                        <option key={choice.id} value={choice.id}>
                          {choice.name}
                        </option>
                      ))}
                    </SelectField>
                  </Field>

                  <Field label="Metodo pagamento">
                    <SelectField
                      value={record.paymentMethod ?? "bonifico"}
                      onChange={(value) =>
                        onChange(index, {
                          paymentMethod:
                            value as InvoiceImportRecordDraft["paymentMethod"],
                        })
                      }
                    >
                      {paymentMethodChoices.map((choice) => (
                        <option key={choice.id} value={choice.id}>
                          {choice.name}
                        </option>
                      ))}
                    </SelectField>
                  </Field>

                  <Field label="Stato pagamento">
                    <SelectField
                      value={record.paymentStatus ?? "in_attesa"}
                      onChange={(value) =>
                        onChange(index, {
                          paymentStatus:
                            value as InvoiceImportRecordDraft["paymentStatus"],
                        })
                      }
                    >
                      {paymentStatusChoices.map((choice) => (
                        <option key={choice.id} value={choice.id}>
                          {choice.name}
                        </option>
                      ))}
                    </SelectField>
                  </Field>
                </>
              ) : record.resource === "services" ? (
                <>
                  <Field label="Tipo servizio">
                    <SelectField
                      value={record.serviceType ?? "altro"}
                      onChange={(value) =>
                        onChange(index, {
                          serviceType:
                            value as InvoiceImportRecordDraft["serviceType"],
                        })
                      }
                    >
                      {serviceTypeChoices.map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </SelectField>
                  </Field>

                  <Field label="Tassabile">
                    <SelectField
                      value={
                        record.isTaxable == null || record.isTaxable
                          ? "true"
                          : "false"
                      }
                      onChange={(value) =>
                        onChange(index, { isTaxable: value === "true" })
                      }
                    >
                      <option value="true">Si</option>
                      <option value="false">No</option>
                    </SelectField>
                  </Field>

                  <Field label="Fee riprese">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={record.feeShooting ?? 0}
                      onChange={(event) =>
                        onChange(index, {
                          feeShooting:
                            event.target.value === ""
                              ? 0
                              : Number(event.target.value),
                        })
                      }
                    />
                  </Field>

                  <Field label="Fee montaggio">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={record.feeEditing ?? 0}
                      onChange={(event) =>
                        onChange(index, {
                          feeEditing:
                            event.target.value === ""
                              ? 0
                              : Number(event.target.value),
                        })
                      }
                    />
                  </Field>

                  <Field label="Fee altro">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={record.feeOther ?? 0}
                      onChange={(event) =>
                        onChange(index, {
                          feeOther:
                            event.target.value === ""
                              ? 0
                              : Number(event.target.value),
                        })
                      }
                    />
                  </Field>

                  <Field label="Sconto">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={record.discount ?? 0}
                      onChange={(event) =>
                        onChange(index, {
                          discount:
                            event.target.value === ""
                              ? 0
                              : Number(event.target.value),
                        })
                      }
                    />
                  </Field>

                  <Field label="Data fine servizio">
                    <Input
                      type="date"
                      value={record.serviceEnd ?? ""}
                      onChange={(event) =>
                        onChange(index, {
                          serviceEnd: event.target.value || null,
                        })
                      }
                    />
                  </Field>

                  <Field label="Giornata intera">
                    <SelectField
                      value={
                        record.allDay == null || record.allDay
                          ? "true"
                          : "false"
                      }
                      onChange={(value) =>
                        onChange(index, { allDay: value === "true" })
                      }
                    >
                      <option value="true">Si</option>
                      <option value="false">No</option>
                    </SelectField>
                  </Field>

                  <Field label="Localita'" className="md:col-span-2">
                    <Input
                      value={record.location ?? ""}
                      onChange={(event) =>
                        onChange(index, { location: event.target.value })
                      }
                    />
                  </Field>

                  <Field label="Km trasferta">
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={record.kmDistance ?? 0}
                      onChange={(event) =>
                        onChange(index, {
                          kmDistance:
                            event.target.value === ""
                              ? 0
                              : Number(event.target.value),
                        })
                      }
                    />
                  </Field>

                  <Field label="Tariffa km">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        record.kmRate ?? operationalConfig.defaultKmRate ?? 0
                      }
                      onChange={(event) =>
                        onChange(index, {
                          kmRate:
                            event.target.value === ""
                              ? 0
                              : Number(event.target.value),
                        })
                      }
                    />
                  </Field>

                  <div className="md:col-span-2">
                    <TravelRouteCalculatorDialog
                      defaultKmRate={operationalConfig.defaultKmRate ?? 0}
                      currentKmRate={record.kmRate}
                      initialDestination={record.location ?? undefined}
                      onApply={(estimate) =>
                        onChange(index, {
                          kmDistance: estimate.totalDistanceKm,
                          kmRate: estimate.kmRate ?? undefined,
                          location: estimate.generatedLocation || undefined,
                        })
                      }
                    />
                  </div>
                </>
              ) : (
                <>
                  <Field label="Tipo spesa">
                    <SelectField
                      value={record.expenseType ?? "acquisto_materiale"}
                      onChange={(value) =>
                        onChange(index, {
                          expenseType:
                            value as InvoiceImportRecordDraft["expenseType"],
                        })
                      }
                    >
                      {expenseTypeChoices.map((choice) => (
                        <option key={choice.id} value={choice.id}>
                          {choice.name}
                        </option>
                      ))}
                    </SelectField>
                  </Field>

                  <Field label="Descrizione spesa" className="md:col-span-2">
                    <Input
                      value={
                        record.description ??
                        expenseTypeLabels[
                          record.expenseType ?? "acquisto_materiale"
                        ] ??
                        ""
                      }
                      onChange={(event) =>
                        onChange(index, { description: event.target.value })
                      }
                    />
                  </Field>
                </>
              )}

              <Field label="Via / Piazza fatturazione">
                <Input
                  value={record.billingAddressStreet ?? ""}
                  onChange={(event) =>
                    onChange(index, {
                      billingAddressStreet: event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Numero civico">
                <Input
                  value={record.billingAddressNumber ?? ""}
                  onChange={(event) =>
                    onChange(index, {
                      billingAddressNumber: event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="CAP">
                <Input
                  value={record.billingPostalCode ?? ""}
                  onChange={(event) =>
                    onChange(index, {
                      billingPostalCode: event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Comune">
                <Input
                  value={record.billingCity ?? ""}
                  onChange={(event) =>
                    onChange(index, { billingCity: event.target.value })
                  }
                />
              </Field>

              <Field label="Provincia">
                <Input
                  value={record.billingProvince ?? ""}
                  onChange={(event) =>
                    onChange(index, { billingProvince: event.target.value })
                  }
                />
              </Field>

              <Field label="Nazione">
                <Input
                  value={record.billingCountry ?? ""}
                  onChange={(event) =>
                    onChange(index, { billingCountry: event.target.value })
                  }
                />
              </Field>

              <Field label="Codice destinatario">
                <Input
                  value={record.billingSdiCode ?? ""}
                  onChange={(event) =>
                    onChange(index, { billingSdiCode: event.target.value })
                  }
                />
              </Field>

              <Field label="PEC">
                <Input
                  value={record.billingPec ?? ""}
                  onChange={(event) =>
                    onChange(index, { billingPec: event.target.value })
                  }
                />
              </Field>

              <Field label="Note import" className="md:col-span-2">
                <Textarea
                  value={record.notes ?? ""}
                  onChange={(event) =>
                    onChange(index, { notes: event.target.value })
                  }
                  className="min-h-24"
                />
              </Field>
            </div>
          </div>
        );
      })}
    </div>
  );
};
