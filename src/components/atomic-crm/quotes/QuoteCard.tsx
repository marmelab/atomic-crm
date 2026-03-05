import { memo, useMemo } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { useGetOne, useRedirect } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";
import {
  Video,
  Scissors,
  Camera,
  Mic,
  FileText,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { Client, Quote } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { formatDateRange } from "../misc/formatDateRange";
import { QuoteCardActions } from "./QuoteCardActions";

export const QuoteCard = memo(
  ({ quote, index }: { quote: Quote; index: number }) => {
    if (!quote) return null;

    return (
      <Draggable draggableId={String(quote.id)} index={index}>
        {(provided, snapshot) => (
          <QuoteCardContent
            provided={provided}
            snapshot={snapshot}
            quote={quote}
          />
        )}
      </Draggable>
    );
  },
);
QuoteCard.displayName = "QuoteCard";

const serviceTypeStyles: Record<
  string,
  { icon: LucideIcon; text: string; bg: string }
> = {
  riprese: { icon: Video, text: "text-blue-600", bg: "bg-blue-50" },
  montaggio: { icon: Scissors, text: "text-purple-600", bg: "bg-purple-50" },
  fotografia: { icon: Camera, text: "text-pink-600", bg: "bg-pink-50" },
  audio: { icon: Mic, text: "text-amber-600", bg: "bg-amber-50" },
  documentazione: { icon: FileText, text: "text-green-600", bg: "bg-green-50" },
  altro: { icon: Briefcase, text: "text-slate-600", bg: "bg-slate-50" },
};

const defaultStyle = serviceTypeStyles.altro;

const QuoteCardContent = ({
  provided,
  snapshot,
  quote,
}: {
  provided?: any;
  snapshot?: any;
  quote: Quote;
}) => {
  const redirect = useRedirect();
  const { quoteServiceTypes } = useConfigurationContext();
  const { data: client } = useGetOne<Client>(
    "clients",
    { id: quote.client_id },
    { enabled: !!quote.client_id },
  );

  const style = serviceTypeStyles[quote.service_type] ?? defaultStyle;
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
    <div
      className="cursor-pointer group relative"
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      ref={provided?.innerRef}
      onClick={() =>
        redirect(
          `/quotes/${quote.id}/show`,
          undefined,
          undefined,
          undefined,
          { _scrollToTop: false },
        )
      }
    >
      <QuoteCardActions quote={quote} client={client} />
      <Card
        className={cn(
          "py-3 transition-shadow duration-200",
          snapshot?.isDragging
            ? "opacity-90 rotate-1 shadow-lg"
            : "shadow-sm hover:shadow-md",
        )}
      >
        <CardContent className="px-3">
          <div className="flex items-start gap-2">
            <div
              className={cn(
                "shrink-0 w-8 h-8 rounded-md flex items-center justify-center",
                style.bg,
              )}
            >
              <Icon className={cn("h-4 w-4", style.text)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium mb-1 truncate">
                {quote.description || "Preventivo"}
              </p>
              {client && (
                <p className="text-xs text-muted-foreground mb-1 truncate">
                  {client.name}
                </p>
              )}
              <p className="text-xs text-muted-foreground truncate">
                {serviceLabel}
                {eventDate && ` - ${eventDate}`}
              </p>
              <p className="text-xs font-medium mt-1">{formattedAmount}</p>
              <div className="mt-2">
                <Badge
                  variant={quote.is_taxable === false ? "secondary" : "outline"}
                  className="text-[10px]"
                >
                  {quote.is_taxable === false ? "Non tassabile" : "Tassabile"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
