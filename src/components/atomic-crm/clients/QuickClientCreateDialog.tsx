import { Loader2, UserPlus } from "lucide-react";
import { useState } from "react";
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

type QuickClientCreateDialogProps = {
  /** When provided, the new client will be linked to this quote */
  linkToQuoteId?: string | number;
  trigger?: React.ReactNode;
};

const getMutationRecord = <T extends object>(result: T | { data: T }) =>
  result && typeof result === "object" && "data" in result
    ? result.data
    : result;

export const QuickClientCreateDialog = ({
  linkToQuoteId,
  trigger,
}: QuickClientCreateDialogProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [create] = useCreate();
  const [update] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    billing_name: "",
  });

  const setField = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const resetForm = () =>
    setForm({ name: "", email: "", phone: "", billing_name: "" });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.name.trim()) {
      notify("Il nome cliente è obbligatorio.", { type: "warning" });
      return;
    }

    if (!form.email.trim()) {
      notify("L'email è obbligatoria.", { type: "warning" });
      return;
    }

    setSaving(true);
    try {
      const result = await create(
        "clients",
        {
          data: {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || null,
            billing_name: form.billing_name.trim() || null,
          },
        },
        { returnPromise: true },
      );
      const created = getMutationRecord(result);

      if (linkToQuoteId && created?.id) {
        await update(
          "quotes",
          {
            id: linkToQuoteId,
            data: { client_id: created.id },
            previousData: {},
          },
          { returnPromise: true },
        ).catch(() => {
          notify(
            "Cliente creato, ma il collegamento al preventivo non è riuscito.",
            { type: "warning" },
          );
        });
      }

      notify("Cliente creato.", { type: "success" });
      refresh();
      resetForm();
      setOpen(false);
    } catch (error) {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Impossibile creare il cliente.";
      notify(msg, { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Nuovo cliente
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Creazione rapida cliente</DialogTitle>
          <DialogDescription>
            Inserisci i dati essenziali. Potrai completare il profilo in
            seguito.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qc-name">Nome</Label>
            <Input
              id="qc-name"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Nome cliente"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qc-email">Email</Label>
            <Input
              id="qc-email"
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              placeholder="email@esempio.it"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qc-phone">Telefono</Label>
            <Input
              id="qc-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
              placeholder="+39 ..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qc-billing">Denominazione fiscale</Label>
            <Input
              id="qc-billing"
              value={form.billing_name}
              onChange={(e) => setField("billing_name", e.target.value)}
              placeholder="Ragione sociale (opzionale)"
            />
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
              Crea cliente
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
