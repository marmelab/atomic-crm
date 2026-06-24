/**
 * Verifiering av Google Places-träffar mot CRM-företaget.
 *
 * Bakgrund: textsearch på företagsnamn returnerar ofta NÅGON verksamhet på
 * orten — utan verifiering rapporterades fel företags betyg/recensioner som
 * kundens (danielssonsbygg-buggen). En träff räknas bara om domänen matchar
 * kundens hemsida ELLER namnet har stark överlappning.
 *
 * Ren modul utan Deno-beroenden — unit-testas med vitest.
 */

const GENERIC_TOKENS = new Set([
  "ab",
  "hb",
  "kb",
  "aktiebolag",
  "handelsbolag",
  "firma",
  "och",
  "the",
]);

function compact(value: string): string {
  return value
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]/g, "");
}

function significantTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-zåäö0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !GENERIC_TOKENS.has(token))
    .sort((a, b) => b.length - a.length);
}

export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    return new URL(withProtocol).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Avgör om en Places-kandidat verkligen är kundens verksamhet.
 *
 * Starkast signal: kandidatens webbplats-domän == kundens domän.
 * Annars: företagsnamnets mest särskiljande token (längst, ej generisk)
 * måste ingå i kandidatnamnet (eller tvärtom). Ortnamn och generiska ord
 * räcker inte — "Vemdalens Fjällhotell" ska inte matcha "danielssonsbygg
 * vemdalen" bara för att orten överlappar.
 */
export function isPlaceMatch(params: {
  companyName: string;
  companyWebsite?: string | null;
  placeName?: string | null;
  placeWebsite?: string | null;
}): boolean {
  const { companyName, companyWebsite, placeName, placeWebsite } = params;

  const companyDomain = domainOf(companyWebsite);
  const placeDomain = domainOf(placeWebsite);
  if (companyDomain && placeDomain && companyDomain === placeDomain) {
    return true;
  }

  if (!placeName) return false;
  const placeCompact = compact(placeName);
  if (!placeCompact) return false;

  // Endast den MEST särskiljande tokenen (längst, ej generisk) används —
  // kortare tokens är ofta ortnamn ("vemdalen") som matchar fel verksamheter
  // på samma ort. Kompakt jämförelse fångar ihopskrivningar:
  // "danielssonsbygg" ⊃ "Danielssons Bygg".
  const tokens = significantTokens(companyName).slice(0, 1);
  if (tokens.length === 0) {
    // Företagsnamn utan särskiljande tokens — jämför hela kompakta namnet.
    const companyCompact = compact(companyName);
    return (
      companyCompact.length >= 4 &&
      (placeCompact.includes(companyCompact) ||
        companyCompact.includes(placeCompact))
    );
  }

  return tokens.some(
    (token) =>
      placeCompact.includes(compact(token)) ||
      compact(token).includes(placeCompact),
  );
}

export type PlaceCandidate = {
  id?: string | null;
  name?: string | null;
  website?: string | null;
  country?: string | null;
};

/**
 * Väljer den första kandidaten som verkligen är kundens svenska verksamhet.
 *
 * Tre grindar i ordning:
 *   1. Land — en träff med känd landskod ≠ "SE" avvisas. Detta stoppar
 *      namnkollisioner över gränsen (svensk "Zontaxi" i Östersund vs holländsk
 *      "Zontaxi" i Zeewolde). Okänd landskod släpps vidare till namnkollen.
 *   2. Namn/domän — isPlaceMatch (särskiljande token eller domänmatch).
 *   3. Domän-motsägelse — namnlik verksamhet med ANNAN hemsida avvisas.
 *
 * Kandidaterna förväntas vara rankade (t.ex. Places searchText-ordning); första
 * som klarar alla grindar vinner.
 */
export function selectVerifiedPlace<T extends PlaceCandidate>(
  company: { name: string; website?: string | null },
  candidates: readonly T[],
): T | null {
  for (const candidate of candidates) {
    if (candidate.country && candidate.country !== "SE") continue;
    if (
      !isPlaceMatch({
        companyName: company.name,
        companyWebsite: company.website,
        placeName: candidate.name,
        placeWebsite: candidate.website,
      })
    ) {
      continue;
    }
    const companyDomain = domainOf(company.website);
    const placeDomain = domainOf(candidate.website);
    if (companyDomain && placeDomain && companyDomain !== placeDomain) {
      continue;
    }
    return candidate;
  }
  return null;
}
