import { Loader2, Plus } from "lucide-react";
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

import {
  projectCategoryChoices,
  projectStatusChoices,
  projectTvShowChoices,
} from "../projects/projectTypes";
import type { Client, Project, Quote } from "../types";
import { buildProjectDraftFromQuote } from "./quoteProjectLinking";

type CreateProjectFromQuoteDialogProps = {
  client?: Client;
  quote: Quote;
  trigger?: React.ReactNode;
};

type ProjectFormState = {
  name: string;
  category: Project["category"] | "";
  tv_show: Project["tv_show"];
  status: Project["status"];
  start_date: string;
  end_date: string;
  all_day: boolean;
  budget: string;
  notes: string;
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
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const toDateTimeLocalValue = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getDefaultState = (
  quote: Quote,
  clientName?: string | null,
): ProjectFormState => {
  const draft = buildProjectDraftFromQuote({
    quote,
    clientName,
  });
  const formatDateValue = quote.all_day
    ? toDateInputValue
    : toDateTimeLocalValue;

  return {
    name: draft.name,
    category: draft.category ?? "",
    tv_show: null,
    status: draft.status,
    start_date: formatDateValue(draft.start_date),
    end_date: formatDateValue(draft.end_date),
    all_day: draft.all_day,
    budget:
      draft.budget != null && Number.isFinite(draft.budget)
        ? String(draft.budget)
        : "",
    notes: draft.notes ?? "",
  };
};

export const CreateProjectFromQuoteDialog = ({
  client,
  quote,
  trigger,
}: CreateProjectFromQuoteDialogProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [create] = useCreate();
  const [update] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [form, setForm] = useState<ProjectFormState>(() =>
    getDefaultState(quote, client?.name),
  );

  useEffect(() => {
    if (!open) {
      setForm(getDefaultState(quote, client?.name));
    }
  }, [client?.name, open, quote]);

  const setField = <K extends keyof ProjectFormState>(
    key: K,
    value: ProjectFormState[K],
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === "category" && value !== "produzione_tv"
        ? { tv_show: null }
        : {}),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim()) {
      notify("Il nome progetto è obbligatorio.", { type: "warning" });
      return;
    }

    if (!form.category) {
      notify("Seleziona una categoria progetto.", { type: "warning" });
      return;
    }

    setSaving(true);

    try {
      const createdProjectResult = await create(
        "projects",
        {
          data: {
            client_id: quote.client_id,
            name: form.name.trim(),
            category: form.category,
            tv_show:
              form.category === "produzione_tv" ? (form.tv_show ?? null) : null,
            status: form.status,
            start_date: form.start_date || null,
            end_date: form.end_date || null,
            all_day: form.all_day,
            budget: form.budget ? Number(form.budget) : null,
            notes: form.notes.trim() || null,
          },
        },
        { returnPromise: true },
      );
      const createdProject = getMutationRecord(createdProjectResult);

      if (!createdProject?.id) {
        throw new Error(
          "Progetto creato, ma la risposta non contiene un id valido.",
        );
      }

      try {
        await update(
          "quotes",
          {
            id: quote.id,
            data: { project_id: createdProject.id },
            previousData: quote,
          },
          { returnPromise: true },
        );

        notify("Progetto creato e collegato al preventivo.", {
          type: "success",
        });
      } catch (linkError) {
        notify(
          getErrorMessage(
            linkError,
            "Progetto creato, ma il collegamento al preventivo non è riuscito. Collega il progetto manualmente.",
          ),
          { type: "warning" },
        );
      }

      refresh();
      setOpen(false);
    } catch (error) {
      notify(
        getErrorMessage(
          error,
          "Impossibile creare il progetto dal preventivo.",
        ),
        { type: "error" },
      );
    } finally {
      setSaving(false);
    }
  };

  const dateInputType = form.all_day ? "date" : "datetime-local";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="default" className="gap-2">
            <Plus className="h-4 w-4" />
            Crea progetto
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crea progetto dal preventivo</DialogTitle>
          <DialogDescription>
            Ti proponiamo dati già coerenti con il preventivo, ma restano tutti
            modificabili prima del salvataggio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="quote-project-name">Nome progetto</Label>
              <Input
                id="quote-project-name"
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
                placeholder="Nome progetto"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote-project-category">Categoria</Label>
              <select
                id="quote-project-category"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.category}
                onChange={(event) =>
                  setField(
                    "category",
                    (event.target.value || "") as ProjectFormState["category"],
                  )
                }
                required
              >
                <option value="">Seleziona categoria</option>
                {projectCategoryChoices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote-project-status">Stato</Label>
              <select
                id="quote-project-status"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={form.status}
                onChange={(event) =>
                  setField("status", event.target.value as Project["status"])
                }
              >
                {projectStatusChoices.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.name}
                  </option>
                ))}
              </select>
            </div>

            {form.category === "produzione_tv" ? (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="quote-project-tv-show">Programma TV</Label>
                <select
                  id="quote-project-tv-show"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.tv_show ?? ""}
                  onChange={(event) =>
                    setField(
                      "tv_show",
                      (event.target.value || null) as Project["tv_show"],
                    )
                  }
                >
                  <option value="">Seleziona programma</option>
                  {projectTvShowChoices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="quote-project-start">Data inizio</Label>
              <Input
                id="quote-project-start"
                type={dateInputType}
                value={form.start_date}
                onChange={(event) => setField("start_date", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote-project-end">Data fine</Label>
              <Input
                id="quote-project-end"
                type={dateInputType}
                value={form.end_date}
                min={form.start_date || undefined}
                onChange={(event) => setField("end_date", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote-project-budget">Budget</Label>
              <Input
                id="quote-project-budget"
                type="number"
                min="0"
                step="0.01"
                value={form.budget}
                onChange={(event) => setField("budget", event.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="quote-project-notes">Note</Label>
              <Textarea
                id="quote-project-notes"
                value={form.notes}
                onChange={(event) => setField("notes", event.target.value)}
                placeholder="Note operative facoltative"
              />
            </div>
          </div>

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
              Crea e collega
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
