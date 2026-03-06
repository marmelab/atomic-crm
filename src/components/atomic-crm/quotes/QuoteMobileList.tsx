import { useMemo, useState } from "react";
import { useListContext } from "ra-core";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { Quote } from "../types";
import {
  quoteStatuses,
  quoteStatusStyles,
  defaultQuoteStatusStyle,
} from "./quotesTypes";
import { getQuotesByStatus } from "./stages";
import { QuoteMobileCard } from "./QuoteMobileCard";

const ALL_TAB = "__all__";

/** Short labels for mobile tabs to save space */
const shortLabels: Record<string, string> = {
  primo_contatto: "Contatto",
  preventivo_inviato: "Inviato",
  in_trattativa: "Trattativa",
  accettato: "Accettato",
  acconto_ricevuto: "Acconto",
  in_lavorazione: "Lavorazione",
  completato: "Completato",
  saldato: "Saldato",
  rifiutato: "Rifiutato",
  perso: "Perso",
};

export const QuoteMobileList = () => {
  const { data: quotes, isPending } = useListContext<Quote>();
  const [activeTab, setActiveTab] = useState(ALL_TAB);

  const quotesByStatus = useMemo(
    () => getQuotesByStatus(quotes ?? [], quoteStatuses),
    [quotes],
  );

  const visibleQuotes = useMemo(() => {
    if (activeTab === ALL_TAB) return quotes ?? [];
    return quotesByStatus[activeTab] ?? [];
  }, [activeTab, quotes, quotesByStatus]);

  const totalAmount = useMemo(
    () =>
      visibleQuotes
        .reduce((sum, q) => sum + (q.amount ?? 0), 0)
        .toLocaleString("it-IT", {
          style: "currency",
          currency: "EUR",
          notation: "compact",
        }),
    [visibleQuotes],
  );

  if (isPending) return null;

  return (
    <div className="flex flex-col">
      {/* Status tabs — horizontal scroll */}
      <div className="overflow-x-auto px-3 py-2 border-b">
        <div className="flex gap-1.5 w-max">
          <TabChip
            label={`Tutti (${quotes?.length ?? 0})`}
            active={activeTab === ALL_TAB}
            onClick={() => setActiveTab(ALL_TAB)}
          />
          {quoteStatuses.map((s) => {
            const count = quotesByStatus[s.value]?.length ?? 0;
            if (count === 0) return null;
            const statusStyle =
              quoteStatusStyles[s.value] ?? defaultQuoteStatusStyle;
            return (
              <TabChip
                key={s.value}
                label={`${shortLabels[s.value] ?? s.label} (${count})`}
                active={activeTab === s.value}
                statusStyle={statusStyle}
                onClick={() => setActiveTab(s.value)}
              />
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 py-2 text-xs text-muted-foreground">
        {visibleQuotes.length} preventiv{visibleQuotes.length === 1 ? "o" : "i"}{" "}
        · {totalAmount}
      </div>

      {/* Card list */}
      <div className="flex flex-col divide-y">
        {visibleQuotes.map((quote) => (
          <QuoteMobileCard key={quote.id} quote={quote} />
        ))}
        {visibleQuotes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nessun preventivo in questo stato
          </p>
        )}
      </div>
    </div>
  );
};

const TabChip = ({
  label,
  active,
  statusStyle,
  onClick,
}: {
  label: string;
  active: boolean;
  statusStyle?: { bg: string; text: string; dot: string };
  onClick: () => void;
}) => (
  <Button
    variant={active ? "default" : "outline"}
    size="sm"
    className={cn(
      "h-7 text-xs whitespace-nowrap gap-1.5",
      !active && statusStyle && statusStyle.bg,
      !active && statusStyle && statusStyle.text,
      !active && "border-transparent",
    )}
    onClick={onClick}
  >
    {statusStyle && !active && (
      <span
        className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusStyle.dot)}
      />
    )}
    {label}
  </Button>
);
