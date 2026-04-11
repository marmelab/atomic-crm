import { AlertTriangle } from "lucide-react";
import { useGetList, useRedirect, useTranslate } from "ra-core";
import { Card } from "@/components/ui/card";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { getDealDecayLevel, type DecayLevel } from "../deals/dealUtils";
import { stageColorMap } from "../deals/stageColors";
import { Badge } from "@/components/ui/badge";

const TERMINAL_STAGES = ["won", "lost"];

export const StaleDeals = () => {
  const translate = useTranslate();
  const { dealStages, currency } = useConfigurationContext();
  const redirect = useRedirect();

  const { data: deals, isPending } = useGetList<Deal>("deals", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "updated_at", order: "ASC" },
    filter: { "archived_at@is": null },
  });

  const staleDeals = (deals ?? [])
    .filter((d) => !TERMINAL_STAGES.includes(d.stage))
    .filter((d) => getDealDecayLevel(d) !== "none")
    .sort(
      (a, b) =>
        new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
    );

  if (isPending || staleDeals.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        <div className="mr-3 flex">
          <AlertTriangle className="text-amber-500 w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-muted-foreground">
          Stale Deals
        </h2>
        <Badge variant="secondary" className="ml-2">
          {staleDeals.length}
        </Badge>
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {staleDeals.map((deal) => {
              const decay = getDealDecayLevel(deal);
              const days = Math.floor(
                (Date.now() - new Date(deal.updated_at).getTime()) / 86400000,
              );
              const stage = dealStages.find((s) => s.value === deal.stage);
              const colors = stageColorMap[deal.stage];

              return (
                <tr
                  key={deal.id}
                  className="border-b last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() =>
                    redirect(`/deals/${deal.id}/show`, undefined, undefined, undefined, {
                      _scrollToTop: false,
                    })
                  }
                >
                  <td className="px-3 py-2.5">
                    <span className="font-medium">{deal.name}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge
                      style={{
                        backgroundColor: colors?.bg ?? "#F5F5F4",
                        color: colors?.text ?? "#1A1A2E",
                        border: `1px solid ${colors?.border ?? "#E5E5E3"}`,
                      }}
                    >
                      {stage?.label ?? deal.stage}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span className="font-medium">
                      {deal.amount.toLocaleString("en-US", {
                        notation: "compact",
                        style: "currency",
                        currency,
                        currencyDisplay: "narrowSymbol",
                        minimumSignificantDigits: 3,
                      })}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <span
                      className={`font-semibold ${
                        decay === "red" ? "text-red-600" : "text-amber-600"
                      }`}
                    >
                      {days}d
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
