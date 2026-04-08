import { useGetList } from "ra-core";
import { memo, useMemo } from "react";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";

export const PipelineSummary = memo(() => {
  const { dealStages } = useConfigurationContext();

  const { data: deals, isPending } = useGetList<Deal>("deals", {
    pagination: { page: 1, perPage: 500 },
  });

  const summary = useMemo(() => {
    if (!deals) return [];

    const byStage: Record<string, { count: number; amount: number }> = {};
    for (const deal of deals) {
      if (!byStage[deal.stage]) byStage[deal.stage] = { count: 0, amount: 0 };
      byStage[deal.stage].count++;
      byStage[deal.stage].amount += deal.amount ?? 0;
    }

    return dealStages
      .map((stage) => ({
        label: stage.label,
        value: stage.value,
        count: byStage[stage.value]?.count ?? 0,
        amount: byStage[stage.value]?.amount ?? 0,
      }))
      .filter((s) => s.count > 0);
  }, [deals, dealStages]);

  if (isPending) return null;
  if (summary.length === 0) return null;

  const totalDeals = summary.reduce((sum, s) => sum + s.count, 0);
  const totalAmount = summary.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-muted-foreground">
          Pipeline
        </h2>
        <div className="text-sm text-muted-foreground">
          {totalDeals} deals &middot; ${totalAmount.toLocaleString()}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {summary.map(({ label, value, count }) => (
          <div
            key={value}
            className="flex flex-col items-center p-2 rounded-md bg-muted/50"
          >
            <span className="text-lg font-bold">{count}</span>
            <span className="text-xs text-muted-foreground text-center leading-tight">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
