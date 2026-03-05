import { Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { useNotify, useRefresh, useUpdate } from "ra-core";

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

import type { Client } from "../types";

type QuickClientEmailDialogProps = {
  client: Client;
};

export const QuickClientEmailDialog = ({
  client,
}: QuickClientEmailDialogProps) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [update] = useUpdate();
  const notify = useNotify();
  const refresh = useRefresh();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmed = email.trim();
    if (!trimmed) {
      notify("L'email è obbligatoria.", { type: "warning" });
      return;
    }

    setSaving(true);
    try {
      await update(
        "clients",
        {
          id: client.id,
          data: { email: trimmed },
          previousData: client,
        },
        { returnPromise: true },
      );
      notify("Email aggiornata.", { type: "success" });
      refresh();
      setEmail("");
      setOpen(false);
    } catch (error) {
      const msg =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Impossibile aggiornare l'email.";
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
        if (!v) setEmail("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Mail className="h-3.5 w-3.5 text-amber-500" />
          Email mancante
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiungi email a {client.name}</DialogTitle>
          <DialogDescription>
            Inserisci l'email per poter inviare preventivi e comunicazioni.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="qce-email">Email</Label>
            <Input
              id="qce-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@esempio.it"
              required
              autoFocus
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
              Salva email
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
