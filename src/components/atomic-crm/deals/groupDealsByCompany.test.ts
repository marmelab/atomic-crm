import { describe, expect, it } from "vitest";

import type { Company, Deal } from "../types";
import { groupDealsByCompany } from "./groupDealsByCompany";

const deal = (id: number, company_id: number | null, amount: number) =>
  ({ id, company_id, amount, name: `Deal ${id}` }) as unknown as Deal;
const company = (id: number, name: string) => ({ id, name }) as Company;

describe("groupDealsByCompany", () => {
  it("groups deals under their company with the summed amount, companies by name", () => {
    const groups = groupDealsByCompany(
      [deal(1, 2, 100), deal(2, 1, 50), deal(3, 2, 25)],
      [company(1, "Zeta"), company(2, "Acme")],
    );

    expect(
      groups.map((g) => [
        g.company?.name,
        g.deals.map((d) => d.id),
        g.totalAmount,
      ]),
    ).toEqual([
      ["Acme", [1, 3], 125],
      ["Zeta", [2], 50],
    ]);
  });

  it("puts deals whose company is unknown in a last group", () => {
    const groups = groupDealsByCompany(
      [deal(1, null, 10), deal(2, 1, 20)],
      [company(1, "Acme")],
    );

    expect(groups.map((g) => g.company?.name ?? null)).toEqual(["Acme", null]);
  });
});
