/**
 * Aggregerar Search Console-data från flera kalendermånad-snapshots till EN
 * periodsiffra (för valbara rapportperioder: kvartal, halvår, kampanj-spann ...).
 *
 * Klick/visningar summeras (additivt över icke-överlappande månader).
 * Position är impressions-viktat snitt (approx mot GSC:s exakta intervall-
 * position — godtagbart för kundrapport). top_queries slås ihop per sökord.
 *
 * Ren modul utan Deno-beroenden — unit-testas med vitest.
 */

export type GscQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr?: number;
  position: number;
};

export type GscPeriod = {
  clicks: number;
  impressions: number;
  ctr?: number;
  position: number;
  top_queries?: GscQueryRow[];
};

export type GscAggregate = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  top_queries: GscQueryRow[];
  /** Hur många månader som faktiskt aggregerades (täckning). */
  months_aggregated: number;
};

export function aggregateSearchConsole(
  periods: Array<GscPeriod | null | undefined>,
): GscAggregate | null {
  const present = periods.filter((p): p is GscPeriod => p != null);
  if (present.length === 0) return null;

  let clicks = 0;
  let impressions = 0;
  let posWeighted = 0;
  let posWeight = 0;
  const queries = new Map<
    string,
    {
      clicks: number;
      impressions: number;
      posWeighted: number;
      posWeight: number;
    }
  >();

  for (const period of present) {
    clicks += period.clicks ?? 0;
    impressions += period.impressions ?? 0;
    posWeighted += (period.position ?? 0) * (period.impressions ?? 0);
    posWeight += period.impressions ?? 0;
    for (const row of period.top_queries ?? []) {
      const acc = queries.get(row.query) ?? {
        clicks: 0,
        impressions: 0,
        posWeighted: 0,
        posWeight: 0,
      };
      acc.clicks += row.clicks ?? 0;
      acc.impressions += row.impressions ?? 0;
      acc.posWeighted += (row.position ?? 0) * (row.impressions ?? 0);
      acc.posWeight += row.impressions ?? 0;
      queries.set(row.query, acc);
    }
  }

  const top_queries: GscQueryRow[] = [...queries.entries()]
    .map(([query, acc]) => ({
      query,
      clicks: acc.clicks,
      impressions: acc.impressions,
      ctr: acc.impressions > 0 ? acc.clicks / acc.impressions : 0,
      position:
        acc.posWeight > 0
          ? Math.round((acc.posWeighted / acc.posWeight) * 10) / 10
          : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 50);

  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position:
      posWeight > 0 ? Math.round((posWeighted / posWeight) * 10) / 10 : 0,
    top_queries,
    months_aggregated: present.length,
  };
}
