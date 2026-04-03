import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors.ts";
import { AuthMiddleware } from "../_shared/authentication.ts";

const PAPPERS_BASE = "https://api.pappers.fr/v2";

async function handler(req: Request): Promise<Response> {
  const apiToken = Deno.env.get("PAPPERS_API_KEY");
  if (!apiToken) {
    console.error("[enrich-pappers] PAPPERS_API_KEY secret is not set");
    return new Response(
      JSON.stringify({ error: "PAPPERS_API_KEY not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let body: { siret?: string; siren?: string; q?: string };
  try {
    body = await req.json();
  } catch (e) {
    console.error("[enrich-pappers] Failed to parse request body:", e);
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { siret, siren, q } = body;
  console.log("[enrich-pappers] Request:", { siret, siren, q: q?.slice(0, 50) });

  // If SIRET or SIREN provided → direct lookup
  if (siret || siren) {
    const identifier = siret ? `siret=${siret}` : `siren=${siren}`;
    const url = `${PAPPERS_BASE}/entreprise?${identifier}&api_token=${apiToken}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      console.error(`[enrich-pappers] Pappers API error ${res.status}:`, text);
      return new Response(
        JSON.stringify({ error: `Pappers error: ${res.status}`, detail: text }),
        {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const data = await res.json();
    console.log("[enrich-pappers] Lookup success:", data.siren ?? data.siret_siege);
    return new Response(JSON.stringify(mapPappersResult(data)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Otherwise → search by name
  if (q) {
    const url = `${PAPPERS_BASE}/recherche?q=${encodeURIComponent(q)}&par_page=5&api_token=${apiToken}`;
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text();
      console.error(`[enrich-pappers] Pappers search error ${res.status}:`, text);
      return new Response(
        JSON.stringify({ error: `Pappers error: ${res.status}`, detail: text }),
        {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const data = await res.json();
    const results = (data.resultats ?? []).map((r: PappersSearchResult) => ({
      siren: r.siren,
      siret: r.siege?.siret,
      name: r.nom_entreprise,
      city: r.siege?.ville,
      zipcode: r.siege?.code_postal,
      forme_juridique: r.forme_juridique,
    }));
    console.log(`[enrich-pappers] Search "${q}" → ${results.length} results`);
    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.warn("[enrich-pappers] No siret, siren or q provided");
  return new Response(
    JSON.stringify({ error: "Provide siret, siren, or q parameter" }),
    {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

function mapPappersResult(data: PappersEntreprise) {
  const siege = data.siege ?? {};
  const latestFinance = (data.finances ?? []).at(0);
  return {
    siren: data.siren,
    siret: siege.siret ?? data.siret_siege,
    name: data.denomination ?? data.nom_commercial,
    forme_juridique: data.forme_juridique,
    code_naf: data.code_naf,
    libelle_naf: data.libelle_code_naf,
    // Address
    address: siege.adresse_ligne_1,
    city: siege.ville,
    zipcode: siege.code_postal,
    state: siege.departement,
    country: siege.pays ?? "France",
    // Size
    effectif: data.effectif,
    effectif_min: data.effectif_min,
    effectif_max: data.effectif_max,
    tranche_effectif: data.tranche_effectif,
    // Financials
    chiffre_affaires: latestFinance?.chiffre_affaires,
    resultat: latestFinance?.resultat,
    annee_finances: latestFinance?.annee,
  };
}

// Minimal type hints for Pappers API response
interface PappersEntreprise {
  siren?: string;
  siret_siege?: string;
  denomination?: string;
  nom_commercial?: string;
  forme_juridique?: string;
  code_naf?: string;
  libelle_code_naf?: string;
  effectif?: number;
  effectif_min?: number;
  effectif_max?: number;
  tranche_effectif?: string;
  siege?: {
    siret?: string;
    adresse_ligne_1?: string;
    ville?: string;
    code_postal?: string;
    departement?: string;
    pays?: string;
  };
  finances?: Array<{
    annee?: number;
    chiffre_affaires?: number;
    resultat?: number;
  }>;
}

interface PappersSearchResult {
  siren?: string;
  nom_entreprise?: string;
  forme_juridique?: string;
  siege?: {
    siret?: string;
    ville?: string;
    code_postal?: string;
  };
}

Deno.serve((req) =>
  OptionsMiddleware(req, (req) => AuthMiddleware(req, handler)),
);
