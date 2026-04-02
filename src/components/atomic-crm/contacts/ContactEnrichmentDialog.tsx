import { useState } from "react";
import { useUpdate, useNotify, useRecordContext } from "ra-core";
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { getSupabaseClient } from "../providers/supabase/supabase";
import { useConfigurationContext } from "../root/ConfigurationContext";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import type { Contact } from "../types";

interface DropcontactContactResult {
  email?: string;
  phone?: string;
  linkedin_url?: string;
  job_title?: string;
  siren?: string;
  siret?: string;
}

export const ContactEnrichmentDialog = () => {
  const record = useRecordContext<Contact>();
  const { dropcontactApiKey } = useConfigurationContext();
  const [open, setOpen] = useState(false);
  const [update] = useUpdate();
  const notify = useNotify();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DropcontactContactResult | null>(null);

  if (!record) return null;

  const handleEnrich = async () => {
    if (!dropcontactApiKey) return;
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await getSupabaseClient().functions.invoke(
        "enrich-dropcontact",
        {
          body: {
            apiKey: dropcontactApiKey,
            type: "contact",
            data: {
              first_name: record.first_name,
              last_name: record.last_name,
              email: record.email_jsonb?.[0]?.email,
              company_name: record.company_name,
            },
          },
        },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
    } catch (e) {
      notify(
        `Erreur Dropcontact: ${e instanceof Error ? e.message : String(e)}`,
        { type: "error" },
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!result) return;
    const patch: Partial<Contact> = {};

    // Add email if not already present
    if (result.email) {
      const emails = record.email_jsonb ?? [];
      const alreadyHas = emails.some((e) => e.email === result.email);
      if (!alreadyHas) {
        patch.email_jsonb = [...emails, { email: result.email, type: "Work" }];
      }
    }

    // Add phone if not already present
    if (result.phone) {
      const phones = record.phone_jsonb ?? [];
      const alreadyHas = phones.some((p) => p.number === result.phone);
      if (!alreadyHas) {
        patch.phone_jsonb = [...phones, { number: result.phone, type: "Work" }];
      }
    }

    if (result.linkedin_url && !record.linkedin_url)
      patch.linkedin_url = result.linkedin_url;

    if (Object.keys(patch).length === 0) {
      notify("Tous les champs sont déjà renseignés", { type: "info" });
      return;
    }

    await update(
      "contacts",
      { id: record.id, data: patch, previousData: record },
      {
        onSuccess: () => {
          notify("Contact enrichi avec Dropcontact", { type: "success" });
          setOpen(false);
        },
        onError: () =>
          notify("Erreur lors de la mise à jour", { type: "error" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-6 text-xs">
          <Sparkles className="w-3 h-3" />
          Enrichir
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Enrichir — {record.first_name} {record.last_name}
          </DialogTitle>
        </DialogHeader>

        {!dropcontactApiKey ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
            <AlertCircle className="w-8 h-8 text-muted-foreground/50" />
            <p>
              Dropcontact n'est pas configuré.
              <br />
              Ajoutez votre clé API dans{" "}
              <a
                href="#/connectors"
                className="underline hover:no-underline font-medium text-foreground"
              >
                Paramètres → Connecteurs
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Dropcontact va chercher l'email professionnel, le téléphone et le
              profil LinkedIn de ce contact.
            </p>

            <div className="rounded-md border px-3 py-2 text-sm bg-muted/30 space-y-0.5">
              <div>
                <span className="text-muted-foreground">Contact : </span>
                <span className="font-medium">
                  {record.first_name} {record.last_name}
                </span>
              </div>
              {record.company_name && (
                <div>
                  <span className="text-muted-foreground">Société : </span>
                  <span>{record.company_name}</span>
                </div>
              )}
            </div>

            <Button
              onClick={handleEnrich}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enrichissement en cours (~30s)…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Enrichir avec Dropcontact
                </>
              )}
            </Button>

            {result && (
              <div className="border rounded-md p-3 flex flex-col gap-1.5 text-sm bg-muted/30">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Données trouvées
                </p>
                <ResultField label="Email pro" value={result.email} />
                <ResultField label="Téléphone" value={result.phone} />
                <ResultField label="LinkedIn" value={result.linkedin_url} />
                <ResultField label="Poste" value={result.job_title} />
                <ResultField label="SIRET" value={result.siret} />
                <Button className="mt-2 w-full" size="sm" onClick={handleApply}>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Appliquer les champs manquants
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const ResultField = ({ label, value }: { label: string; value?: string }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="font-medium break-all">{value}</span>
    </div>
  );
};
