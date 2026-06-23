/**
 * Branded vs non-branded-klassning av Search Console-sökord.
 *
 * Branded = sökningen innehåller varumärket (företagsnamns-token eller domän).
 * Non-branded-tillväxt är den äkta SEO-vinsten: nya kunder som UPPTÄCKER
 * företaget via tjänstesökningar, inte bara fler som redan kan namnet och
 * googlar det. Utan denna uppdelning ser "klick +20 %" bra ut även när det
 * bara är fler varumärkessökningar.
 *
 * Ren modul utan Deno-beroenden — unit-testas med vitest.
 */
import { domainOf } from "./matching.ts";

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

export type BrandedQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
};

export type BrandedSplitBucket = {
  clicks: number;
  impressions: number;
  queries: number;
};

export type BrandedSplit = {
  branded: BrandedSplitBucket;
  non_branded: BrandedSplitBucket;
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Varumärkes-tokens: särskiljande ord ur företagsnamnet (>= 4 tecken, ej
 * generiska bolagsord) plus domänens andranivå-etikett (t.ex. "axona" ur
 * axona.se). Returnerar normaliserade (accent-fria) tokens.
 */
export function brandTokens(
  companyName: string,
  website?: string | null,
): string[] {
  const tokens = new Set<string>();
  for (const token of normalize(companyName).split(" ")) {
    if (token.length >= 4 && !GENERIC_TOKENS.has(token)) tokens.add(token);
  }
  const domain = domainOf(website);
  if (domain) {
    const label = normalize(domain.split(".")[0] ?? "").replace(/\s+/g, "");
    if (label.length >= 4 && !GENERIC_TOKENS.has(label)) tokens.add(label);
  }
  return [...tokens];
}

export function isBranded(query: string, tokens: string[]): boolean {
  if (!tokens.length) return false;
  const normalized = normalize(query);
  const words = new Set(normalized.split(" "));
  const compact = normalized.replace(/\s+/g, "");
  // Långa tokens (>= 6 tecken, t.ex. domän-etikett eller särskiljande namn)
  // matchas mot hela den ihopskrivna frågan. Korta tokens måste matcha ett
  // HELT ord — annars klassas branschord som "bygg" eller "data" felaktigt
  // som varumärke i generiska tjänstesökningar ("byggmaterial pris").
  return tokens.some((token) =>
    token.length >= 6 ? compact.includes(token) : words.has(token),
  );
}

export function classifyBrandedQueries(
  queries: BrandedQueryRow[],
  tokens: string[],
): BrandedSplit {
  const split: BrandedSplit = {
    branded: { clicks: 0, impressions: 0, queries: 0 },
    non_branded: { clicks: 0, impressions: 0, queries: 0 },
  };
  for (const row of queries) {
    const bucket = isBranded(row.query, tokens)
      ? split.branded
      : split.non_branded;
    bucket.clicks += row.clicks ?? 0;
    bucket.impressions += row.impressions ?? 0;
    bucket.queries += 1;
  }
  return split;
}
