import { Briefcase } from "lucide-react";
import { useGetList } from "ra-core";
import { useMemo } from "react";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";

import type { Deal } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";

const DEFAULT_LOCALE = "fr-FR";
const CURRENCY = "EUR";

const CLOSED_STAGES = ["closed-won", "perdu", "trial-failed", "declined"];

const stageBadgeStyles: Record<string, string> = {
  lead: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  qualified:
    "bg-[var(--nosho-green)]/15 text-[var(--nosho-green-dark)] dark:bg-[var(--nosho-green)]/20",
  "follow-up":
    "bg-[var(--nosho-orange)]/15 text-[var(--nosho-orange-dark)] dark:bg-[var(--nosho-orange)]/20",
  "rdv-prix":
    "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  trial:
    "bg-[var(--nosho-teal)]/15 text-[var(--nosho-teal)] dark:bg-[var(--nosho-teal)]/20",
};

export function ActiveDeals() {
  const { dealStages } = useConfigurationContext();
  const { data: allDeals, isPending } = useGetList<Deal>("deals", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "updated_at", order: "DESC" },
  });

  const data = useMemo(
    () =>
      allDeals
        ?.filter((d) => !CLOSED_STAGES.includes(d.stage))
        .slice(0, 8) ?? [],
    [allDeals],
  );
  const total = data.length;

  const getStageLabel = (stageValue: string) => {
    const stage = dealStages.find((s) => s.value === stageValue);
    return stage?.label ?? stageValue;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        <div className="mr-3 flex">
          <Briefcase className="text-muted-foreground w-5 h-5" />
        </div>
        <h2 className="text-base font-semibold text-muted-foreground flex-1">
          Opportunités actives
        </h2>
        <span className="text-xs text-muted-foreground">{total ?? 0} total</span>
      </div>
      <Card className="p-0 overflow-hidden shadow-sm border-border/50">
        {isPending ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 bg-muted/30 rounded animate-pulse"
              />
            ))}
          </div>
        ) : !data?.length ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Aucune opportunité active
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-2.5 bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Opportunité</span>
              <span className="w-20 text-right">Montant</span>
              <span className="w-24 text-center">Statut</span>
            </div>
            {data.map((deal) => (
              <Link
                key={deal.id}
                to={`/deals/${deal.id}/show`}
                className="grid grid-cols-[1fr_auto_auto] gap-2 px-4 py-3 items-center hover:bg-muted/30 transition-colors no-underline text-foreground"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{deal.name}</p>
                </div>
                <span className="w-20 text-right text-sm font-medium tabular-nums">
                  {deal.amount.toLocaleString(DEFAULT_LOCALE, {
                    style: "currency",
                    currency: CURRENCY,
                    minimumFractionDigits: 0,
                  })}
                </span>
                <span className="w-24 flex justify-center">
                  <span
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
                      stageBadgeStyles[deal.stage] ??
                      "bg-muted text-muted-foreground"
                    }`}
                  >
                    {getStageLabel(deal.stage)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
