import { format, isValid } from "date-fns";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import type { Quote, QuoteItem } from "../types";
import { quoteStatusLabels } from "./quotesTypes";
import { formatDateRange } from "../misc/formatDateRange";
import { getQuoteItemLineTotal } from "./quoteItems";
import { QuotePaymentsSection } from "./QuotePaymentsSection";

type QuoteShowSectionsProps = {
  quote: Quote;
  client?: { name?: string } | null;
  project?: { id: string | number; name: string } | null;
  serviceLabel: string;
  quoteItems: QuoteItem[];
};

export const QuoteShowSections = ({
  quote,
  client,
  project,
  serviceLabel,
  quoteItems,
}: QuoteShowSectionsProps) => {
  const statusLabel = quoteStatusLabels[quote.status] ?? quote.status;

  return (
    <div className="space-y-2">
      {/* Details grid */}
      <div className="flex flex-wrap gap-8 mx-4">
        <InfoField label="Cliente" value={client?.name} />
        <InfoField label="Progetto collegato">
          {project ? (
            <Link
              to={`/projects/${project.id}/show`}
              className="text-sm text-primary hover:underline"
            >
              {project.name}
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">
              Nessun progetto collegato
            </span>
          )}
        </InfoField>
        <InfoField label="Tipo servizio" value={serviceLabel} />
        <InfoField label="Stato">
          <Badge variant="secondary">{statusLabel}</Badge>
        </InfoField>
        <InfoField label="Tassabilità">
          <Badge variant={quote.is_taxable === false ? "secondary" : "outline"}>
            {quote.is_taxable === false ? "Non tassabile" : "Tassabile"}
          </Badge>
        </InfoField>
        <InfoField
          label="Importo"
          value={quote.amount.toLocaleString("it-IT", {
            style: "currency",
            currency: "EUR",
          })}
        />
      </div>

      {/* Dates */}
      <div className="flex flex-wrap gap-8 mx-4 mt-4">
        {quote.event_start && (
          <InfoField
            label="Evento"
            value={formatDateRange(
              quote.event_start,
              quote.event_end,
              quote.all_day,
            )}
          />
        )}
        {quote.sent_date && isValid(new Date(quote.sent_date)) && (
          <InfoField
            label="Data invio"
            value={format(new Date(quote.sent_date), "dd/MM/yyyy")}
          />
        )}
        {quote.response_date && isValid(new Date(quote.response_date)) && (
          <InfoField
            label="Data risposta"
            value={format(new Date(quote.response_date), "dd/MM/yyyy")}
          />
        )}
      </div>

      {/* Payments */}
      <QuotePaymentsSection quote={quote} />

      {/* Quote items table */}
      {quoteItems.length > 0 && (
        <>
          <Separator className="my-4 mx-4" />
          <div className="mx-4 space-y-3">
            <span className="text-xs text-muted-foreground tracking-wide">
              Voci preventivo
            </span>
            <div className="rounded-md border">
              {quoteItems.map((item, index) => (
                <div
                  key={`${item.description}-${index}`}
                  className="flex items-start justify-between gap-4 border-b px-3 py-3 last:border-b-0"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} ×{" "}
                      {item.unit_price.toLocaleString("it-IT", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </p>
                  </div>
                  <p className="text-sm font-medium">
                    {getQuoteItemLineTotal(item).toLocaleString("it-IT", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Rejection reason */}
      {quote.rejection_reason && (
        <>
          <Separator className="my-4 mx-4" />
          <div className="mx-4">
            <span className="text-xs text-muted-foreground tracking-wide">
              Motivo rifiuto
            </span>
            <p className="text-sm">{quote.rejection_reason}</p>
          </div>
        </>
      )}

      {/* Notes */}
      {quote.notes && (
        <>
          <Separator className="my-4 mx-4" />
          <div className="mx-4 whitespace-pre-line">
            <span className="text-xs text-muted-foreground tracking-wide">
              Note
            </span>
            <p className="text-sm leading-6">{quote.notes}</p>
          </div>
        </>
      )}
    </div>
  );
};

const InfoField = ({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) => (
  <div className="flex flex-col">
    <span className="text-xs text-muted-foreground tracking-wide">{label}</span>
    {children ?? <span className="text-sm">{value}</span>}
  </div>
);
