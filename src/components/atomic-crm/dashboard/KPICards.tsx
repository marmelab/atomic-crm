import { Users, Euro, Trophy } from "lucide-react";
import { useGetList, useGetMany } from "ra-core";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";

import type { Company, Contact, Deal } from "../types";

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

function HotContactsCard({ contacts }: { contacts: Contact[] | undefined }) {
  const hotCount = contacts?.length ?? 0;
  return (
    <Card className="p-5 flex flex-col gap-3 shadow-sm border-border/50 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Contacts chauds
        </span>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--nosho-green)]/15 text-[var(--nosho-green-dark)]">
          {hotCount}
        </span>
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="text-3xl font-bold tracking-tight text-foreground">
            {hotCount}
          </span>
          <span className="text-xs text-muted-foreground">ce mois</span>
          {hotCount > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {contacts!.slice(0, 5).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 text-xs min-w-0"
                >
                  <span className="truncate text-foreground/80 font-medium">
                    {c.first_name} {c.last_name}
                  </span>
                  {c.company_name && (
                    <span className="shrink-0 text-muted-foreground truncate max-w-[45%] text-right">
                      {c.company_name}
                    </span>
                  )}
                </li>
              ))}
              {hotCount > 5 && (
                <li className="text-xs text-muted-foreground">
                  +{hotCount - 5} autres
                </li>
              )}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted/60 shrink-0">
          <Users className="w-5 h-5 text-[var(--nosho-teal)]" />
        </div>
      </div>
    </Card>
  );
}

function RevenuePrevisionnelCard({ deals }: { deals: Deal[] | undefined }) {
  const [trialPct, setTrialPct] = useState(70);

  const { revenue, monthDeals } = useMemo(() => {
    if (!deals) return { revenue: 0, monthDeals: [] as Deal[] };

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const md = deals.filter((d) => {
      if (d.stage !== "trial" && d.stage !== "closed-won") return false;
      if (!d.expected_closing_date) return false;
      const closing = new Date(d.expected_closing_date);
      return (
        closing.getFullYear() === currentYear &&
        closing.getMonth() === currentMonth
      );
    });

    const won = md
      .filter((d) => d.stage === "closed-won")
      .reduce((acc, d) => acc + (d.amount ?? 0), 0);
    const trial = md
      .filter((d) => d.stage === "trial")
      .reduce((acc, d) => acc + (d.amount ?? 0), 0);

    return {
      monthDeals: md,
      revenue: won + trial * (trialPct / 100),
    };
  }, [deals, trialPct]);

  const companyIds = useMemo(
    () => [...new Set(monthDeals.map((d) => d.company_id))],
    [monthDeals],
  );

  const { data: companies } = useGetMany<Company>(
    "companies",
    { ids: companyIds },
    { enabled: companyIds.length > 0 },
  );

  const companyMap = useMemo(
    () => Object.fromEntries((companies ?? []).map((c) => [c.id, c.name])),
    [companies],
  );

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
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="text-3xl font-bold tracking-tight text-foreground">
            {formattedRevenue}
          </span>
          <span className="text-xs text-muted-foreground">
            Gagné 100% · Essai {trialPct}% · mois en cours
          </span>
          {monthDeals.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {monthDeals.map((d) => {
                const mrr = d.amount ? Math.round(d.amount / 12) : null;
                const isWon = d.stage === "closed-won";
                return (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 text-xs min-w-0"
                  >
                    <span className="truncate text-foreground/80 font-medium">
                      {companyMap[d.company_id] ?? d.name}
                    </span>
                    <span
                      className={`shrink-0 font-semibold ${isWon ? "text-[var(--nosho-green-dark)]" : "text-[var(--nosho-orange-dark)]"}`}
                    >
                      {mrr != null && mrr > 0
                        ? `${mrr.toLocaleString("fr-FR")} €/m`
                        : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted/60 shrink-0">
          <Euro className="w-5 h-5 text-[var(--nosho-orange)]" />
        </div>
      </div>
    </Card>
  );
}

function WonDealsCard({ deals }: { deals: Deal[] | undefined }) {
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth();
  const lm = cm === 0 ? 11 : cm - 1;
  const ly = cm === 0 ? cy - 1 : cy;

  const { wonThisMonth, wonLastMonthCount } = useMemo(() => {
    const wonDeals = deals?.filter((d) => d.stage === "closed-won") ?? [];
    return {
      wonThisMonth: wonDeals.filter((d) => {
        if (!d.updated_at) return false;
        const u = new Date(d.updated_at);
        return u.getFullYear() === cy && u.getMonth() === cm;
      }),
      wonLastMonthCount: wonDeals.filter((d) => {
        if (!d.updated_at) return false;
        const u = new Date(d.updated_at);
        return u.getFullYear() === ly && u.getMonth() === lm;
      }).length,
    };
  }, [deals, cy, cm, ly, lm]);

  const companyIds = useMemo(
    () => [...new Set(wonThisMonth.map((d) => d.company_id))],
    [wonThisMonth],
  );

  const { data: companies } = useGetMany<Company>(
    "companies",
    { ids: companyIds },
    { enabled: companyIds.length > 0 },
  );

  const companyMap = useMemo(
    () => Object.fromEntries((companies ?? []).map((c) => [c.id, c.name])),
    [companies],
  );

  const wonChange = wonThisMonth.length - wonLastMonthCount;

  return (
    <Card className="p-5 flex flex-col gap-3 shadow-sm border-border/50 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Opportunités gagnées
        </span>
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full ${
            wonChange > 0
              ? "bg-[var(--nosho-green)]/15 text-[var(--nosho-green-dark)]"
              : wonChange < 0
                ? "bg-[var(--nosho-orange)]/15 text-[var(--nosho-orange-dark)]"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {wonChange > 0 ? "+" : ""}
          {wonChange}
        </span>
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <span className="text-3xl font-bold tracking-tight text-foreground">
            {wonThisMonth.length}
          </span>
          <span className="text-xs text-muted-foreground">ce mois</span>
          {wonThisMonth.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1.5">
              {wonThisMonth.map((d) => {
                const mrr = d.amount ? Math.round(d.amount / 12) : null;
                return (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-2 text-xs min-w-0"
                  >
                    <span className="truncate text-foreground/80 font-medium">
                      {companyMap[d.company_id] ?? d.name}
                    </span>
                    {mrr != null && mrr > 0 && (
                      <span className="shrink-0 text-[var(--nosho-green-dark)] font-semibold">
                        {mrr.toLocaleString("fr-FR")} €/m
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted/60 shrink-0">
          <Trophy className="w-5 h-5 text-[var(--nosho-green)]" />
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

  const hotCount = useMemo(() => hotContacts?.length ?? 0, [hotContacts]);

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
      <HotContactsCard contacts={hotContacts} />
      <RevenuePrevisionnelCard deals={deals} />
      <WonDealsCard deals={deals} />
    </div>
  );
}
