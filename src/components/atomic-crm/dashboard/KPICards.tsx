import { TrendingDown, TrendingUp, Users, Euro, Trophy } from "lucide-react";
import { useGetList } from "ra-core";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";

import type { Contact, Deal } from "../types";

const DEFAULT_LOCALE = "fr-FR";
const CURRENCY = "EUR";

const TRIAL_PERCENTAGES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

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

function RevenuePrevisionnelCard({ deals }: { deals: Deal[] | undefined }) {
  const [trialPct, setTrialPct] = useState(70);

  const { revenue, wonRevenue, trialRevenue } = useMemo(() => {
    if (!deals) return { revenue: 0, wonRevenue: 0, trialRevenue: 0 };

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const monthDeals = deals.filter((d) => {
      if (d.stage !== "trial" && d.stage !== "closed-won") return false;
      if (!d.expected_closing_date) return false;
      const closing = new Date(d.expected_closing_date);
      return (
        closing.getFullYear() === currentYear &&
        closing.getMonth() === currentMonth
      );
    });

    const won = monthDeals
      .filter((d) => d.stage === "closed-won")
      .reduce((acc, d) => acc + (d.amount ?? 0), 0);

    const trial = monthDeals
      .filter((d) => d.stage === "trial")
      .reduce((acc, d) => acc + (d.amount ?? 0), 0);

    return {
      wonRevenue: won,
      trialRevenue: trial,
      revenue: won + trial * (trialPct / 100),
    };
  }, [deals, trialPct]);

  const formattedRevenue = revenue.toLocaleString(DEFAULT_LOCALE, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return (
    <Card className="p-5 flex flex-col gap-3 shadow-sm border-border/50 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Revenus prévisionnels
        </span>
        {/* Percentage selector for "Essai" stage weighting */}
        <select
          value={trialPct}
          onChange={(e) => setTrialPct(Number(e.target.value))}
          className="text-xs font-bold px-2 py-0.5 rounded-full border border-[var(--nosho-orange)]/40 bg-[var(--nosho-orange)]/10 text-[var(--nosho-orange-dark)] cursor-pointer focus:outline-none"
          title="Pondération des deals en Essai"
        >
          {TRIAL_PERCENTAGES.map((p) => (
            <option key={p} value={p}>
              Essai {p}%
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end justify-between">
        <div className="flex flex-col">
          <span className="text-3xl font-bold tracking-tight text-foreground">
            {formattedRevenue}
          </span>
          <span className="text-xs text-muted-foreground mt-1">
            Gagné 100% · Essai {trialPct}% · mois en cours
          </span>
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted/60">
          <Euro className="w-5 h-5 text-[var(--nosho-orange)]" />
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

  const { data: deals, isPending: isPendingDeals } = useGetList<Deal>("deals", {
    pagination: { page: 1, perPage: 500 },
  });

  const kpis = useMemo(() => {
    const hotCount = hotContacts?.length ?? 0;

    const wonDeals = deals?.filter((d) => d.stage === "closed-won") ?? [];

    const now = new Date();
    const cy = now.getFullYear();
    const cm = now.getMonth();
    const lm = cm === 0 ? 11 : cm - 1;
    const ly = cm === 0 ? cy - 1 : cy;

    const wonThisMonth = wonDeals.filter((d) => {
      if (!d.updated_at) return false;
      const u = new Date(d.updated_at);
      return u.getFullYear() === cy && u.getMonth() === cm;
    }).length;

    const wonLastMonth = wonDeals.filter((d) => {
      if (!d.updated_at) return false;
      const u = new Date(d.updated_at);
      return u.getFullYear() === ly && u.getMonth() === lm;
    }).length;

    return { hotCount, wonThisMonth, wonChange: wonThisMonth - wonLastMonth };
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
      <RevenuePrevisionnelCard deals={deals} />
      <KPICard
        title="Opportunités gagnées"
        value={kpis.wonThisMonth}
        icon={<Trophy className="w-5 h-5 text-[var(--nosho-green)]" />}
        change={kpis.wonChange}
        changeLabel="ce mois"
        changeType={
          kpis.wonChange > 0
            ? "positive"
            : kpis.wonChange < 0
              ? "negative"
              : "neutral"
        }
      />
    </div>
  );
}
