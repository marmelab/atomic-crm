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

function compact(value: string): string {
  return value
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]/g, "");
}

// Generiska ord som INTE särskiljer ett företag — juridiska suffix, branschord
// och ortnamn. Lagras i kompakt form (å/ä→a, ö→o). Matchning får ALDRIG ske
// enbart på dessa, annars fastnar t.ex. "Furuhov Hundpark" på ett annat
// "hundpark", eller "JVS Maskiner" på vilken maskinfirma som helst.
const GENERIC_COMPACT = new Set<string>([
  // juridiskt / bindeord
  "ab",
  "hb",
  "kb",
  "aktiebolag",
  "handelsbolag",
  "firma",
  "och",
  "the",
  // bransch
  "bygg",
  "maleri",
  "snickeri",
  "elservice",
  "vvs",
  "ror",
  "maskiner",
  "maskin",
  "energi",
  "kakel",
  "farg",
  "akeri",
  "entreprenad",
  "service",
  "stadservice",
  "stad",
  "transport",
  "platservice",
  "plat",
  "tak",
  "hundpark",
  "taxi",
  "bil",
  "ventilation",
  "golv",
  "mark",
  "schakt",
  "grav",
  "anlaggning",
  "fastighet",
  "fastigheter",
  "design",
  "montage",
  // ort / region (Jämtland m.fl.)
  "ostersund",
  "ostersunds",
  "jamtland",
  "jamtlands",
  "harjedalen",
  "froson",
  "rodon",
  "rodons",
  "krokom",
  "brunflo",
  "vemdalen",
  "are",
  "loke",
  "lit",
  "stortorget",
  "sverige",
]);

// Särskiljande ord = signifikanta ord (≥4 tecken) minus de generiska. Längst
// först (mest särskiljande).
function significantTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-zåäö0-9\s]/g, " ")
    .split(/\s+/)
    .filter(
      (token) => token.length >= 4 && !GENERIC_COMPACT.has(compact(token)),
    )
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
 * Annars: minst ett av företagsnamnets SÄRSKILJANDE ord (ej bransch-/ortord)
 * måste ingå i kandidatnamnet. Saknas särskiljande ord (kort akronym +
 * branschord) krävs att hela namnet finns i kandidaten. Generiska ord räcker
 * aldrig ensamma — "Vemdalens Fjällhotell" matchar inte "danielssonsbygg
 * vemdalen", och ett annat "Hundpark" matchar inte "Furuhov Hundpark".
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

  // Matcha på företagets SÄRSKILJANDE ord (varumärkesdelen) — inte på generiska
  // bransch-/ortord. Räcker att NÅGON särskiljande del finns i platsnamnet,
  // vilket tillåter namnvariationer ("Christoffer Sandgren …" ↔ "Sandgren Bygg")
  // men sållar bort fel företag i samma bransch ("Furuhov" ≠ annat "Hundpark").
  const distinctive = significantTokens(companyName);
  if (distinctive.length > 0) {
    return distinctive.some((token) => placeCompact.includes(compact(token)));
  }

  // Inget särskiljande ord kvar (kort akronym + branschord, t.ex. "MB Färg &
  // Kakel", "JVS Maskiner") — kräv då att HELA företagsnamnet finns i
  // platsnamnet, annars riskerar vi att fastna på vilken branschfirma som helst.
  const companyCompact = compact(
    companyName.replace(/\b(ab|hb|kb|aktiebolag|handelsbolag)\b/gi, " "),
  );
  return companyCompact.length >= 4 && placeCompact.includes(companyCompact);
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
