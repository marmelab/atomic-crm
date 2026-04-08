import { Briefcase } from "lucide-react";
import { useGetList } from "ra-core";
import { memo, useMemo } from "react";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";

type Company = {
  id: number;
  trade_type_id?: string | null;
};

type TradeType = {
  id: string;
  name: string;
};

export const DealsByTradeType = memo(() => {
  const { currency } = useConfigurationContext();

  const { data: deals, isPending: dealsPending } = useGetList<Deal>("deals", {
    pagination: { page: 1, perPage: 500 },
    filter: { "stage@neq": "lost" },
  });

  const { data: companies, isPending: companiesPending } = useGetList<Company>(
    "companies",
    { pagination: { page: 1, perPage: 500 } },
  );

  const { data: tradeTypes, isPending: tradeTypesPending } =
    useGetList<TradeType>("trade_types", {
      pagination: { page: 1, perPage: 100 },
    });

  const grouped = useMemo(() => {
    if (!deals || !companies || !tradeTypes) return [];

    const companyTradeMap = new Map<number, string>();
    for (const c of companies) {
      if (c.trade_type_id) {
        const tt = tradeTypes.find((t) => t.id === c.trade_type_id);
        if (tt) companyTradeMap.set(c.id as number, tt.name);
      }
    }

    const counts: Record<string, { count: number; amount: number }> = {};
    for (const deal of deals) {
      const tradeName =
        companyTradeMap.get(deal.company_id as number) ?? "Unassigned";
      if (!counts[tradeName]) counts[tradeName] = { count: 0, amount: 0 };
      counts[tradeName].count++;
      counts[tradeName].amount += deal.amount ?? 0;
    }

    return Object.entries(counts)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, { count, amount }]) => ({ name, count, amount }));
  }, [deals, companies, tradeTypes]);

  if (dealsPending || companiesPending || tradeTypesPending) return null;
  if (grouped.length === 0) return null;

  return (
    <div className="flex flex-col">
      <div className="flex items-center mb-4">
        <div className="mr-3 flex">
          <Briefcase className="text-muted-foreground w-5 h-5" />
        </div>
        <h2 className="text-lg font-semibold text-muted-foreground">
          Deals by Trade Type
        </h2>
      </div>
      <div className="space-y-2">
        {grouped.map(({ name, count, amount }) => (
          <div
            key={name}
            className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50"
          >
            <span className="text-sm font-medium">{name}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {count} {count === 1 ? "deal" : "deals"}
              </span>
              {amount > 0 && (
                <span className="text-sm font-semibold tabular-nums">
                  {amount.toLocaleString(undefined, {
                    style: "currency",
                    currency,
                    maximumFractionDigits: 0,
                  })}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
