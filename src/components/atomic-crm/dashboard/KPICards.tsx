import { TrendingDown, TrendingUp, Users, Euro, Trophy } from "lucide-react";
import { useGetList } from "ra-core";
import { useMemo } from "react";
import { Card } from "@/components/ui/card";

import type { Contact, Deal } from "../types";

const DEFAULT_LOCALE = "fr-FR";
const CURRENCY = "EUR";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change: number;
  changeLabel: string;
  changeType: "positive" | "negative" | "neutral";
}

function KPICard({
  title,
  value,
  icon,
  change,
  changeLabel,
  changeType,
}: KPICardProps) {
  return (
    <Card className="p-5 flex flex-col gap-3 shadow-sm border-border/50 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            changeType === "positive"
              ? "bg-[var(--nosho-green)]/15 text-[var(--nosho-green-dark)]"
              : changeType === "negative"
                ? "bg-[var(--nosho-orange)]/15 text-[var(--nosho-orange-dark)]"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {change > 0 ? "+" : ""}
          {change}
          {typeof change === "number" && changeLabel.includes("%") ? "%" : ""}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <div className="flex flex-col">
          <span className="text-3xl font-bold tracking-tight text-foreground">
            {value}
          </span>
          <span className="text-xs text-muted-foreground mt-1">
            {changeLabel}
          </span>
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted/60">
          {icon}
        </div>
      </div>
    </Card>
  );
}

export function KPICards() {
  const { data: hotContacts, isPending: isPendingContacts } =
    useGetList<Contact>("contacts", {
      pagination: { page: 1, perPage: 100 },
      filter: { status: "hot" },
    });

  const { data: deals, isPending: isPendingDeals } = useGetList<Deal>(
    "deals",
    {
      pagination: { page: 1, perPage: 500 },
    },
  );

  const kpis = useMemo(() => {
    const hotCount = hotContacts?.length ?? 0;

    const wonDeals =
      deals?.filter((d) => d.stage === "closed-won") ?? [];
    const wonCount = wonDeals.length;
    const wonRevenue = wonDeals.reduce((acc, d) => acc + d.amount, 0);

    // Calculate pending revenue (weighted)
    const multiplier: Record<string, number> = {
      lead: 0.1,
      qualified: 0.3,
      "follow-up": 0.5,
      trial: 0.8,
    };
    const pendingRevenue =
      deals
        ?.filter((d) =>
          ["lead", "qualified", "follow-up", "trial"].includes(d.stage),
        )
        .reduce((acc, d) => acc + d.amount * (multiplier[d.stage] ?? 0), 0) ??
      0;

    const totalRevenue = wonRevenue + pendingRevenue;

    return { hotCount, wonCount, totalRevenue };
  }, [hotContacts, deals]);

  if (isPendingContacts || isPendingDeals) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-5 h-[120px] animate-pulse bg-muted/30" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <KPICard
        title="Contacts chauds"
        value={kpis.hotCount}
        icon={<Users className="w-5 h-5 text-[var(--nosho-teal)]" />}
        change={4}
        changeLabel="ce mois"
        changeType="positive"
      />
      <KPICard
        title="Revenus prévisionnels"
        value={kpis.totalRevenue.toLocaleString(DEFAULT_LOCALE, {
          style: "currency",
          currency: CURRENCY,
          minimumFractionDigits: 0,
        })}
        icon={<Euro className="w-5 h-5 text-[var(--nosho-orange)]" />}
        change={-8}
        changeLabel="% ce mois"
        changeType="negative"
      />
      <KPICard
        title="Opportunités gagnées"
        value={kpis.wonCount}
        icon={<Trophy className="w-5 h-5 text-[var(--nosho-green)]" />}
        change={2}
        changeLabel="ce mois"
        changeType="positive"
      />
    </div>
  );
}
