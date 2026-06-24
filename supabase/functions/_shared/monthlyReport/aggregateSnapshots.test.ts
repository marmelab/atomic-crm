import { describe, expect, it } from "vitest";
import { aggregateSearchConsole } from "./aggregateSnapshots.ts";

describe("aggregateSearchConsole", () => {
  it("returnerar null för tom lista", () => {
    expect(aggregateSearchConsole([])).toBeNull();
    expect(aggregateSearchConsole([null, undefined])).toBeNull();
  });

  it("summerar klick/visningar och viktar position på visningar", () => {
    const result = aggregateSearchConsole([
      { clicks: 10, impressions: 100, position: 10 },
      { clicks: 30, impressions: 300, position: 2 },
    ]);
    expect(result?.clicks).toBe(40);
    expect(result?.impressions).toBe(400);
    // viktad: (10*100 + 2*300) / 400 = 1600/400 = 4.0
    expect(result?.position).toBe(4);
    // ctr = 40/400 = 0.1
    expect(result?.ctr).toBeCloseTo(0.1);
    expect(result?.months_aggregated).toBe(2);
  });

  it("slår ihop top_queries per sökord och sorterar på klick", () => {
    const result = aggregateSearchConsole([
      {
        clicks: 5,
        impressions: 50,
        position: 5,
        top_queries: [
          { query: "axona", clicks: 3, impressions: 30, position: 4 },
          { query: "crm", clicks: 2, impressions: 20, position: 8 },
        ],
      },
      {
        clicks: 7,
        impressions: 70,
        position: 3,
        top_queries: [
          { query: "axona", clicks: 5, impressions: 40, position: 2 },
        ],
      },
    ]);
    const axona = result?.top_queries.find((q) => q.query === "axona");
    expect(axona?.clicks).toBe(8); // 3 + 5
    expect(axona?.impressions).toBe(70); // 30 + 40
    // viktad position: (4*30 + 2*40) / 70 = (120+80)/70 = 2.857 → 2.9
    expect(axona?.position).toBe(2.9);
    // sorterat på klick: axona (8) före crm (2)
    expect(result?.top_queries[0].query).toBe("axona");
  });

  it("ignorerar saknade månader (täckning < antal efterfrågade)", () => {
    const result = aggregateSearchConsole([
      { clicks: 1, impressions: 10, position: 5 },
      null,
      { clicks: 2, impressions: 20, position: 5 },
    ]);
    expect(result?.months_aggregated).toBe(2);
    expect(result?.clicks).toBe(3);
  });
});
