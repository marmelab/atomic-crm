import { useMemo } from "react";
import { useGetOne, useRedirect } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { Client, Quote } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { formatDateRange } from "../misc/formatDateRange";
import {
  quoteStatusLabels,
  quoteStatusStyles,
  defaultQuoteStatusStyle,
} from "./quotesTypes";
import {
  serviceTypeStyles,
  defaultServiceTypeStyle,
} from "./quoteServiceStyles";

export const QuoteMobileCard = ({ quote }: { quote: Quote }) => {
  const redirect = useRedirect();
  const { quoteServiceTypes } = useConfigurationContext();
  const { data: client } = useGetOne<Client>(
    "clients",
    { id: quote.client_id },
    { enabled: !!quote.client_id },
  );

  const style =
    serviceTypeStyles[quote.service_type] ?? defaultServiceTypeStyle;
  const statusStyle =
    quoteStatusStyles[quote.status] ?? defaultQuoteStatusStyle;
  const Icon = style.icon;

  const serviceLabel =
    quoteServiceTypes.find((t) => t.value === quote.service_type)?.label ??
    quote.service_type;

  const eventDate = formatDateRange(
    quote.event_start,
    quote.event_end,
    quote.all_day,
  );

  const formattedAmount = useMemo(
    () =>
      quote.amount.toLocaleString("it-IT", {
        style: "currency",
        currency: "EUR",
      }),
    [quote.amount],
  );

  return (
    <button
      type="button"
      className="flex items-start gap-3 px-4 py-3 w-full text-left active:bg-muted/50"
      onClick={() =>
        redirect(`/quotes/${quote.id}/show`, undefined, undefined, undefined, {
          _scrollToTop: false,
        })
      }
    >
      <div
        className={cn(
          "shrink-0 w-9 h-9 rounded-md flex items-center justify-center mt-0.5",
          style.bg,
        )}
      >
        <Icon className={cn("h-4 w-4", style.text)} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {quote.description || "Preventivo"}
        </p>
        {client && (
          <p className="text-xs text-muted-foreground truncate">
            {client.name}
          </p>
        )}
        <p className="text-xs text-muted-foreground truncate">
          {serviceLabel}
          {eventDate && ` — ${eventDate}`}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm font-semibold">{formattedAmount}</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] border-transparent",
              statusStyle.bg,
              statusStyle.text,
            )}
          >
            {quoteStatusLabels[quote.status] ?? quote.status}
          </Badge>
          {quote.is_taxable === false && (
            <Badge variant="secondary" className="text-[10px]">
              Non tass.
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
};
