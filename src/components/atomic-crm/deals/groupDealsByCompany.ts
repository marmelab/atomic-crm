import type { Identifier } from "ra-core";

import type { Company, Deal } from "../types";

export interface DealCompanyGroup {
  companyId: Identifier | null;
  company?: Company;
  deals: Deal[];
  totalAmount: number;
}

/**
 * Groups deals by company, companies sorted by name (deals without a known
 * company last), deals inside a group in the list order.
 */
export const groupDealsByCompany = (
  deals: Deal[],
  companies: Company[],
): DealCompanyGroup[] => {
  const companyById = new Map(companies.map((c) => [String(c.id), c]));
  const groups = new Map<string, DealCompanyGroup>();
  for (const deal of deals) {
    const key = deal.company_id == null ? "" : String(deal.company_id);
    const group = groups.get(key) ?? {
      companyId: deal.company_id ?? null,
      company: companyById.get(key),
      deals: [],
      totalAmount: 0,
    };
    groups.set(key, {
      ...group,
      deals: [...group.deals, deal],
      totalAmount: group.totalAmount + (deal.amount ?? 0),
    });
  }
  return [...groups.values()].sort((a, b) => {
    if (!a.company) return 1;
    if (!b.company) return -1;
    return a.company.name.localeCompare(b.company.name);
  });
};
