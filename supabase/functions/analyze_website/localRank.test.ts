import { describe, expect, it } from "vitest";
import { findLocalPosition, type LocalFinderItem } from "./localRank.ts";

const items: LocalFinderItem[] = [
  { rank_group: 1, title: "Konkurrent Bygg AB", domain: "konkurrent.se" },
  {
    rank_group: 2,
    title: "Östersunds Måleri AB",
    domain: "ostersundsmaleri.se",
  },
  { rank_group: 3, title: "Annat Företag", domain: "annat.se" },
];

describe("findLocalPosition", () => {
  it("matchar på domän (starkast) och returnerar rank_group", () => {
    const result = findLocalPosition(items, {
      website: "https://www.ostersundsmaleri.se",
      name: "Östersunds Måleri AB",
    });
    expect(result.found).toBe(true);
    expect(result.position).toBe(2);
  });

  it("matchar på namn-token när domän saknas", () => {
    const result = findLocalPosition(items, {
      website: null,
      name: "Östersunds Måleri",
    });
    expect(result.found).toBe(true);
    expect(result.position).toBe(2);
  });

  it("returnerar found=false när kunden inte finns i kartpaketet", () => {
    const result = findLocalPosition(items, {
      website: "https://minsajt.se",
      name: "Unika Snickerier AB",
    });
    expect(result.found).toBe(false);
    expect(result.position).toBeNull();
  });

  it("faller tillbaka på rank_absolute om rank_group saknas", () => {
    const result = findLocalPosition(
      [{ rank_absolute: 7, title: "Solo Firma", domain: "solo.se" }],
      { website: "https://solo.se", name: "Solo Firma" },
    );
    expect(result.position).toBe(7);
  });
});
