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

import type { Quote } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { formatDateRange } from "../misc/formatDateRange";
import { QuoteCardActions } from "./QuoteCardActions";

export const QuoteCard = ({
  quote,
  index,
}: {
  quote: Quote;
  index: number;
}) => {
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
};

const serviceTypeIcons: Record<string, LucideIcon> = {
  riprese: Video,
  montaggio: Scissors,
  fotografia: Camera,
  audio: Mic,
  documentazione: FileText,
  altro: Briefcase,
};

const serviceTypeColors: Record<string, string> = {
  riprese: "text-blue-600 bg-blue-50",
  montaggio: "text-purple-600 bg-purple-50",
  fotografia: "text-pink-600 bg-pink-50",
  audio: "text-amber-600 bg-amber-50",
  documentazione: "text-green-600 bg-green-50",
  altro: "text-slate-600 bg-slate-50",
};

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
  const { data: client } = useGetOne(
    "clients",
    {
      id: quote.client_id,
    },
    {
      enabled: !!quote.client_id,
    },
  );

  const handleClick = () => {
    redirect(`/quotes/${quote.id}/show`, undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  const serviceLabel =
    quoteServiceTypes.find((t) => t.value === quote.service_type)?.label ??
    quote.service_type;
  const eventDate = formatDateRange(
    quote.event_start,
    quote.event_end,
    quote.all_day,
  );

  const Icon = serviceTypeIcons[quote.service_type] ?? Briefcase;
  const iconColorClass =
    serviceTypeColors[quote.service_type]?.split(" ")[0] ?? "text-slate-600";
  const iconBgClass =
    serviceTypeColors[quote.service_type]?.split(" ")[1] ?? "bg-slate-50";

  return (
    <div
      className="cursor-pointer group relative"
      {...provided?.draggableProps}
      {...provided?.dragHandleProps}
      ref={provided?.innerRef}
      onClick={handleClick}
    >
      <QuoteCardActions quote={quote} />
      <Card
        className={`py-3 transition-all duration-200 ${
          snapshot?.isDragging
            ? "opacity-90 transform rotate-1 shadow-lg"
            : "shadow-sm hover:shadow-md"
        }`}
      >
        <CardContent className="px-3">
          <div className="flex items-start gap-2">
            <div
              className={cn(
                "flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center",
                iconBgClass,
              )}
            >
              <Icon className={cn("h-4 w-4", iconColorClass)} />
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
              <p className="text-xs font-medium mt-1">
                {quote.amount.toLocaleString("it-IT", {
                  style: "currency",
                  currency: "EUR",
                })}
              </p>
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
