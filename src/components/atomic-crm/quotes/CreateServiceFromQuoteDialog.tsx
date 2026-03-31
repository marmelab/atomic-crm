import { Loader2, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { useCreate, useNotify, useRefresh, useUpdate } from "ra-core";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toBusinessISODate } from "@/lib/dateTimezone";

import type { Client, Quote, Service } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  buildServiceDraftFromQuote,
  type ServiceDraftFromQuote,
} from "./quoteServiceLinking";
import { buildProjectDraftFromQuote } from "./quoteProjectLinking";

type CreateServiceFromQuoteDialogProps = {
  client?: Client;
  quote: Quote;
  trigger?: React.ReactNode;
};

type ServiceFormState = {
  service_type: Service["service_type"];
  description: string;
  service_date: string;
  service_end: string;
  all_day: boolean;
  is_taxable: boolean;
  fee_shooting: string;
  fee_editing: string;
  fee_other: string;
  notes: string;
  createProject: boolean;
  projectName: string;
};

const getMutationRecord = <T extends object>(result: T | { data: T }) =>
  result && typeof result === "object" && "data" in result
    ? result.data
    : result;

const getErrorMessage = (error: unknown, fallback: string) =>
  error && typeof error === "object" && "message" in error && error.message
    ? String(error.message)
    : fallback;

const toDateInputValue = (value?: string) => {
  if (!value) return "";
  return toBusinessISODate(value) ?? "";
};

const getDefaultState = (
  draft: ServiceDraftFromQuote,
  quote: Quote,
  clientName?: string | null,
): ServiceFormState => ({
  service_type: draft.service_type,
  description: draft.description ?? "",
  service_date: toDateInputValue(draft.service_date),
  service_end: toDateInputValue(draft.service_end),
  all_day: draft.all_day,
  is_taxable: draft.is_taxable,
  fee_shooting: String(draft.fee_shooting),
  fee_editing: String(draft.fee_editing),
  fee_other: String(draft.fee_other),
  notes: "",
  createProject: !quote.project_id,
  projectName: !quote.project_id
    ? buildProjectDraftFromQuote({ quote, clientName }).name
    : "",
});

export const CreateServiceFromQuoteDialog = ({
  client,
  quote,
  trigger,
}: CreateServiceFromQuoteDialogProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [create] = useCreate();
  const [update] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();
  const { serviceTypeChoices } = useConfigurationContext();

  const draft = buildServiceDraftFromQuote({ quote });
  const [form, setForm] = useState<ServiceFormState>(() =>
    getDefaultState(draft, quote, client?.name),
  );

  useEffect(() => {
    if (!open) {
      setForm(getDefaultState(draft, quote, client?.name));
    }
    // Reset on open/close only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setField = <K extends keyof ServiceFormState>(
    key: K,
    value: ServiceFormState[K],
  ) => setForm((current) => ({ ...current, [key]: value }));

  const feeTotal =
    Number(form.fee_shooting || 0) +
    Number(form.fee_editing || 0) +
    Number(form.fee_other || 0);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.service_date) {
      notify("La data servizio è obbligatoria.", { type: "warning" });
      return;
    }

    setSaving(true);
    let projectId = quote.project_id;

    try {
      // Step 1: Create project if requested
      if (form.createProject && !quote.project_id) {
        const projectDraft = buildProjectDraftFromQuote({
          quote,
          clientName: client?.name,
        });
        const projectResult = await create(
          "projects",
          {
            data: {
              client_id: quote.client_id,
              name: form.projectName.trim() || projectDraft.name,
              category: projectDraft.category ?? null,
              status: projectDraft.status,
              start_date: form.service_date || null,
              end_date: form.service_end || null,
              all_day: form.all_day,
              budget: quote.amount > 0 ? quote.amount : null,
            },
          },
          { returnPromise: true },
        );
        const createdProject = getMutationRecord(projectResult);
        if (createdProject?.id) {
          projectId = createdProject.id;
          // Link quote to project
          await update(
            "quotes",
            {
              id: quote.id,
              data: { project_id: projectId },
              previousData: quote,
            },
            { returnPromise: true },
          ).catch(() => {
            // Non-blocking: project created but link failed
          });
        }
      }

      // Step 2: Create service
      await create(
        "services",
        {
          data: {
            client_id: quote.client_id,
            project_id: projectId ?? null,
            service_type: form.service_type,
            description: form.description.trim() || null,
            service_date: form.service_date,
            service_end: form.service_end || null,
            all_day: form.all_day,
            is_taxable: form.is_taxable,
            fee_shooting: Number(form.fee_shooting) || 0,
            fee_editing: Number(form.fee_editing) || 0,
            fee_other: Number(form.fee_other) || 0,
            discount: 0,
            km_distance: 0,
            km_rate: 0,
            notes: form.notes.trim() || null,
          },
        },
        { returnPromise: true },
      );

      notify("Servizio registrato dal preventivo.", { type: "success" });
      refresh();
      setOpen(false);
    } catch (error) {
      notify(
        getErrorMessage(
          error,
          "Impossibile creare il servizio dal preventivo.",
        ),
        { type: "error" },
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-2">
            <Wrench className="h-4 w-4" />
            Registra servizio
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registra servizio dal preventivo</DialogTitle>
          <DialogDescription>
            Dati pre-compilati dal preventivo. Distribuisci il compenso tra le
            voci prima di salvare.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="svc-type">Tipo servizio</Label>
              <select
                id="svc-type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.service_type}
                onChange={(e) =>
                  setField(
                    "service_type",
                    e.target.value as Service["service_type"],
                  )
                }
                required
              >
                {serviceTypeChoices.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="svc-description">Descrizione</Label>
              <Input
                id="svc-description"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                placeholder="Titolo o riepilogo del servizio"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="svc-date">Data servizio</Label>
              <Input
                id="svc-date"
                type="date"
                value={form.service_date}
                onChange={(e) => setField("service_date", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="svc-end">Data fine</Label>
              <Input
                id="svc-end"
                type="date"
                value={form.service_end}
                min={form.service_date || undefined}
                onChange={(e) => setField("service_end", e.target.value)}
              />
            </div>

            {/* Fee breakdown */}
            <div className="space-y-2">
              <Label htmlFor="svc-fee-shooting">Compenso riprese (EUR)</Label>
              <Input
                id="svc-fee-shooting"
                type="number"
                min="0"
                step="0.01"
                value={form.fee_shooting}
                onChange={(e) => setField("fee_shooting", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="svc-fee-editing">Compenso montaggio (EUR)</Label>
              <Input
                id="svc-fee-editing"
                type="number"
                min="0"
                step="0.01"
                value={form.fee_editing}
                onChange={(e) => setField("fee_editing", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="svc-fee-other">Compenso altro (EUR)</Label>
              <Input
                id="svc-fee-other"
                type="number"
                min="0"
                step="0.01"
                value={form.fee_other}
                onChange={(e) => setField("fee_other", e.target.value)}
              />
            </div>

            <div className="space-y-2 flex items-end">
              <p className="text-sm">
                Totale:{" "}
                <span
                  className={
                    feeTotal !== quote.amount
                      ? "text-amber-600 font-semibold"
                      : "font-semibold"
                  }
                >
                  {feeTotal.toLocaleString("it-IT", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </span>
                {feeTotal !== quote.amount && (
                  <span className="text-xs text-muted-foreground ml-1">
                    (preventivo:{" "}
                    {quote.amount.toLocaleString("it-IT", {
                      style: "currency",
                      currency: "EUR",
                    })}
                    )
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="svc-notes">Note</Label>
              <Textarea
                id="svc-notes"
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Note operative facoltative"
              />
            </div>
          </div>

          {/* Create project checkbox */}
          {!quote.project_id && (
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="svc-create-project"
                  checked={form.createProject}
                  onCheckedChange={(checked) =>
                    setField("createProject", checked === true)
                  }
                />
                <Label htmlFor="svc-create-project" className="font-medium">
                  Crea anche progetto
                </Label>
              </div>
              {form.createProject && (
                <div className="space-y-2 pl-6">
                  <Label htmlFor="svc-project-name">Nome progetto</Label>
                  <Input
                    id="svc-project-name"
                    value={form.projectName}
                    onChange={(e) => setField("projectName", e.target.value)}
                    placeholder="Nome progetto"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Registra servizio
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
