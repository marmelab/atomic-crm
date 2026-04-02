import { useState } from "react";
import { useUpdate, useNotify, useRecordContext } from "ra-core";
import { Sparkles, Search, Loader2, CheckCircle2 } from "lucide-react";
import { getSupabaseClient } from "../providers/supabase/supabase";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import type { Company } from "../types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PappersSearchResult {
  siren: string;
  siret?: string;
  name?: string;
  city?: string;
  zipcode?: string;
  forme_juridique?: string;
}

interface PappersEnrichment {
  siren?: string;
  siret?: string;
  name?: string;
  forme_juridique?: string;
  address?: string;
  city?: string;
  zipcode?: string;
  state?: string;
  country?: string;
  effectif?: number;
  effectif_min?: number;
  effectif_max?: number;
  chiffre_affaires?: number;
  annee_finances?: number;
}

interface PhantomEnrichment {
  name?: string;
  description?: string;
  website?: string;
  industry?: string;
  size?: number;
  logo?: string;
  headquarters?: { city?: string; country?: string };
  specialities?: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRevenue(amount?: number): string {
  if (!amount) return "";
  if (amount >= 1_000_000)
    return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")} M€`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)} k€`;
  return `${amount} €`;
}

function effectifToSize(
  effectif?: number,
  min?: number,
  max?: number,
): 1 | 10 | 50 | 250 | 500 | undefined {
  const n = effectif ?? max ?? min;
  if (!n) return undefined;
  if (n < 2) return 1;
  if (n < 10) return 10;
  if (n < 50) return 10;
  if (n < 250) return 50;
  if (n < 500) return 250;
  return 500;
}

// ─── Main component ───────────────────────────────────────────────────────────

export const EnrichmentDialog = () => {
  const record = useRecordContext<Company>();
  const [open, setOpen] = useState(false);

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Enrichir
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Enrichir la fiche — {record.name}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="pappers">
          <TabsList className="w-full">
            <TabsTrigger value="pappers" className="flex-1">
              Pappers
            </TabsTrigger>
            <TabsTrigger
              value="phantombuster"
              className="flex-1"
              disabled={!record.linkedin_url}
              title={
                !record.linkedin_url
                  ? "Renseignez l'URL LinkedIn pour utiliser PhantomBuster"
                  : undefined
              }
            >
              PhantomBuster
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pappers" className="mt-4">
            <PappersTab record={record} onDone={() => setOpen(false)} />
          </TabsContent>

          <TabsContent value="phantombuster" className="mt-4">
            <PhantomBusterTab record={record} onDone={() => setOpen(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

// ─── Pappers tab ──────────────────────────────────────────────────────────────

const PappersTab = ({
  record,
  onDone,
}: {
  record: Company;
  onDone: () => void;
}) => {
  const [update] = useUpdate();
  const notify = useNotify();

  const [query, setQuery] = useState(record.name ?? "");
  const [siret, setSiret] = useState(record.tax_identifier ?? "");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<
    PappersSearchResult[] | null
  >(null);
  const [enrichment, setEnrichment] = useState<PappersEnrichment | null>(null);

  const callFunction = async (body: object) => {
    const { data, error } = await getSupabaseClient().functions.invoke(
      "enrich-pappers",
      { body },
    );
    if (error) throw error;
    return data;
  };

  const handleSearch = async () => {
    setLoading(true);
    setSearchResults(null);
    setEnrichment(null);
    try {
      const data = await callFunction({ q: query });
      if (data?.error) throw new Error(data.error);
      setSearchResults(data.results ?? []);
    } catch (e) {
      notify(`Erreur Pappers: ${e instanceof Error ? e.message : String(e)}`, {
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLookupSiret = async () => {
    setLoading(true);
    setSearchResults(null);
    setEnrichment(null);
    try {
      const data = await callFunction({ siret });
      if (data?.error) throw new Error(data.error);
      setEnrichment(data);
    } catch (e) {
      notify(`Erreur SIRET: ${e instanceof Error ? e.message : String(e)}`, {
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectResult = async (result: PappersSearchResult) => {
    if (!result.siret && !result.siren) return;
    setLoading(true);
    try {
      const data = await callFunction(
        result.siret ? { siret: result.siret } : { siren: result.siren },
      );
      setEnrichment(data);
      setSearchResults(null);
    } catch {
      notify("Erreur lors du chargement des données", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!enrichment) return;
    const patch: Partial<Company> = {};

    if (enrichment.address && !record.address)
      patch.address = enrichment.address;
    if (enrichment.city && !record.city) patch.city = enrichment.city;
    if (enrichment.zipcode && !record.zipcode)
      patch.zipcode = enrichment.zipcode;
    if (enrichment.country && !record.country)
      patch.country = enrichment.country;
    if (enrichment.siret && !record.tax_identifier)
      patch.tax_identifier = enrichment.siret;
    if (enrichment.chiffre_affaires && !record.revenue)
      patch.revenue = formatRevenue(enrichment.chiffre_affaires);
    const newSize = effectifToSize(
      enrichment.effectif,
      enrichment.effectif_min,
      enrichment.effectif_max,
    );
    if (newSize && !record.size) patch.size = newSize;

    if (Object.keys(patch).length === 0) {
      notify("Tous les champs sont déjà renseignés", { type: "info" });
      return;
    }

    await update(
      "companies",
      { id: record.id, data: patch, previousData: record },
      {
        onSuccess: () => {
          notify("Fiche enrichie avec Pappers", { type: "success" });
          onDone();
        },
        onError: () =>
          notify("Erreur lors de la mise à jour", { type: "error" }),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Enrichissez automatiquement l'adresse, le SIRET, l'effectif et le CA
        depuis le registre français des entreprises.
      </p>

      {/* SIRET direct lookup */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs mb-1 block">SIRET / SIREN</Label>
          <Input
            placeholder="Ex: 26750019100033"
            value={siret}
            onChange={(e) => setSiret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookupSiret()}
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-5"
          onClick={handleLookupSiret}
          disabled={loading || !siret}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex-1 h-px bg-border" />
        ou rechercher par nom
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Name search */}
      <div className="flex gap-2">
        <Input
          placeholder="Nom de la société…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSearch}
          disabled={loading || !query}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Search results */}
      {searchResults && searchResults.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Aucun résultat
        </p>
      )}
      {searchResults && searchResults.length > 0 && (
        <div className="border rounded-md divide-y text-sm">
          {searchResults.map((r) => (
            <button
              key={r.siren}
              onClick={() => handleSelectResult(r)}
              className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
            >
              <div className="font-medium">{r.name}</div>
              <div className="text-xs text-muted-foreground">
                {r.city} {r.zipcode} · {r.forme_juridique} ·{" "}
                {r.siret ?? r.siren}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Enrichment preview */}
      {enrichment && (
        <div className="border rounded-md p-3 flex flex-col gap-1.5 text-sm bg-muted/30">
          <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Données trouvées
          </p>
          <EnrichField
            label="SIRET"
            value={enrichment.siret}
            current={record.tax_identifier}
          />
          <EnrichField
            label="Adresse"
            value={enrichment.address}
            current={record.address}
          />
          <EnrichField
            label="Ville"
            value={enrichment.city}
            current={record.city}
          />
          <EnrichField
            label="Code postal"
            value={enrichment.zipcode}
            current={record.zipcode}
          />
          <EnrichField
            label="Pays"
            value={enrichment.country}
            current={record.country}
          />
          {enrichment.chiffre_affaires && (
            <EnrichField
              label="CA"
              value={`${formatRevenue(enrichment.chiffre_affaires)} (${enrichment.annee_finances})`}
              current={record.revenue}
            />
          )}
          {enrichment.effectif && (
            <EnrichField
              label="Effectif"
              value={`${enrichment.effectif} salariés`}
              current={record.size ? String(record.size) : undefined}
            />
          )}
          <Button className="mt-2 w-full" size="sm" onClick={handleApply}>
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Appliquer les champs manquants
          </Button>
        </div>
      )}
    </div>
  );
};

// ─── PhantomBuster tab ────────────────────────────────────────────────────────

const PHANTOMBUSTER_AGENT_ID_KEY = "pb_linkedin_company_agent_id";

const PhantomBusterTab = ({
  record,
  onDone,
}: {
  record: Company;
  onDone: () => void;
}) => {
  const [update] = useUpdate();
  const notify = useNotify();

  const [agentId, setAgentId] = useState(
    () => localStorage.getItem(PHANTOMBUSTER_AGENT_ID_KEY) ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [enrichment, setEnrichment] = useState<PhantomEnrichment | null>(null);

  const handleScrape = async () => {
    if (!agentId || !record.linkedin_url) return;
    localStorage.setItem(PHANTOMBUSTER_AGENT_ID_KEY, agentId);
    setLoading(true);
    setEnrichment(null);
    try {
      const { data, error } = await getSupabaseClient().functions.invoke(
        "enrich-phantombuster",
        { body: { linkedinUrl: record.linkedin_url, agentId } },
      );
      if (error) throw error;
      setEnrichment(data);
    } catch {
      notify("Erreur lors du scraping PhantomBuster", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!enrichment) return;
    const patch: Partial<Company> = {};

    if (enrichment.description && !record.description)
      patch.description = enrichment.description;
    if (enrichment.website && !record.website)
      patch.website = enrichment.website;

    if (Object.keys(patch).length === 0) {
      notify("Tous les champs sont déjà renseignés", { type: "info" });
      return;
    }

    await update(
      "companies",
      { id: record.id, data: patch, previousData: record },
      {
        onSuccess: () => {
          notify("Fiche enrichie avec PhantomBuster", { type: "success" });
          onDone();
        },
        onError: () =>
          notify("Erreur lors de la mise à jour", { type: "error" }),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Enrichissez la description et le site web depuis LinkedIn via
        PhantomBuster. Nécessite un agent "LinkedIn Company Scraper" configuré
        dans votre compte.
      </p>

      <div>
        <Label className="text-xs mb-1 block">Agent ID PhantomBuster</Label>
        <Input
          placeholder="Ex: 1234567890"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Trouvez l'ID dans l'URL de votre Phantom :{" "}
          <span className="font-mono">phantombuster.com/phantoms/ID/...</span>
        </p>
      </div>

      <div className="rounded-md border px-3 py-2 text-sm bg-muted/30">
        <span className="text-muted-foreground">URL LinkedIn : </span>
        <a
          href={record.linkedin_url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:no-underline truncate"
        >
          {record.linkedin_url}
        </a>
      </div>

      <Button
        onClick={handleScrape}
        disabled={loading || !agentId}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Scraping en cours (peut prendre ~30s)…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Lancer le scraping
          </>
        )}
      </Button>

      {enrichment && (
        <div className="border rounded-md p-3 flex flex-col gap-1.5 text-sm bg-muted/30">
          <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Données trouvées
          </p>
          <EnrichField
            label="Site web"
            value={enrichment.website}
            current={record.website}
          />
          <EnrichField
            label="Description"
            value={
              enrichment.description
                ? enrichment.description.slice(0, 120) +
                  (enrichment.description.length > 120 ? "…" : "")
                : undefined
            }
            current={record.description}
          />
          {enrichment.industry && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-24 shrink-0">
                Secteur
              </span>
              <Badge variant="secondary">{enrichment.industry}</Badge>
            </div>
          )}
          {enrichment.logo && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-24 shrink-0">Logo</span>
              <img
                src={enrichment.logo}
                alt="logo"
                className="w-10 h-10 rounded object-contain border"
              />
            </div>
          )}
          <Button className="mt-2 w-full" size="sm" onClick={handleApply}>
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            Appliquer les champs manquants
          </Button>
        </div>
      )}
    </div>
  );
};

// ─── Small helper ─────────────────────────────────────────────────────────────

const EnrichField = ({
  label,
  value,
  current,
}: {
  label: string;
  value?: string;
  current?: string;
}) => {
  if (!value) return null;
  const alreadySet = Boolean(current);
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span
        className={
          alreadySet ? "line-through text-muted-foreground" : "font-medium"
        }
      >
        {value}
      </span>
      {alreadySet && (
        <span className="text-xs text-muted-foreground">(déjà renseigné)</span>
      )}
    </div>
  );
};
