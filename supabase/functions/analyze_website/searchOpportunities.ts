export type SearchQueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchOpportunity = SearchQueryRow & {
  kind: "low_ctr" | "position_4_10" | "position_11_20";
};

export function classifySearchOpportunities(
  rows: SearchQueryRow[],
): SearchOpportunity[] {
  return rows
    .filter((row) => row.impressions >= 10)
    .flatMap((row) => {
      const opportunities: SearchOpportunity[] = [];
      if (row.position >= 4 && row.position <= 10) {
        opportunities.push({ ...row, kind: "position_4_10" });
      } else if (row.position > 10 && row.position <= 20) {
        opportunities.push({ ...row, kind: "position_11_20" });
      }
      if (row.ctr < 0.02 && row.impressions >= 50) {
        opportunities.push({ ...row, kind: "low_ctr" });
      }
      return opportunities;
    })
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);
}
