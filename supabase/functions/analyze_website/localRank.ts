/**
 * Lokal map-pack-rank: hittar kundens placering i Googles kartpaket/local
 * finder för ett sökord, ur ett DataForSEO SERP-svar.
 *
 * Ren modul utan Deno-beroenden — unit-testas med vitest. Själva API-anropet
 * (gated på DATAFORSEO_LOGIN/PASSWORD) ligger i index.ts.
 */
import { domainOf } from "./matching.ts";

export type LocalRankResult = {
  keyword: string;
  position: number | null; // placering i kartpaketet (1 = överst)
  found: boolean;
};

export type LocalFinderItem = {
  rank_group?: number;
  rank_absolute?: number;
  domain?: string;
  url?: string;
  title?: string;
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

// Mest särskiljande token ur företagsnamnet (längst, >= 4 tecken) för
// namnmatchning mot map-pack-titlar.
function longestToken(name: string): string | null {
  const tokens = normalize(name)
    .split(" ")
    .filter((token) => token.length >= 4)
    .sort((a, b) => b.length - a.length);
  return tokens[0] ?? null;
}

/**
 * Hittar kundens position bland map-pack-träffarna. Domänmatch är starkast;
 * annars matchas företagsnamnets mest särskiljande token mot titeln.
 */
export function findLocalPosition(
  items: LocalFinderItem[],
  company: { website?: string | null; name: string },
): { position: number | null; found: boolean } {
  const companyDomain = domainOf(company.website);
  const token = longestToken(company.name);

  for (const item of items) {
    const itemDomain = domainOf(item.domain ?? item.url);
    const byDomain = Boolean(
      companyDomain && itemDomain && companyDomain === itemDomain,
    );
    const byName = Boolean(
      token && item.title && normalize(item.title).includes(token),
    );
    if (byDomain || byName) {
      const position = item.rank_group ?? item.rank_absolute ?? null;
      return { position, found: true };
    }
  }
  return { position: null, found: false };
}
