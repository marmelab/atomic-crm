import { format, isValid } from "date-fns";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
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
      <div className="mx-4 rounded-lg border border-l-[3px] border-l-[#2C3E50] p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#2C3E50]">
          Dettagli
        </p>
        <div className="flex flex-wrap gap-8">
          <InfoField label="Cliente" value={client?.name} />
          <InfoField label="Progetto collegato">
            {project ? (
              <Link
                to={`/projects/${project.id}/show`}
                className="text-sm text-[#456B6B] font-medium hover:underline"
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
            <Badge
              variant={
                quote.is_taxable === false ? "secondary" : "outline"
              }
            >
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
      </div>

      {/* Dates */}
      <div className="mx-4 mt-3 rounded-lg border border-l-[3px] border-l-[#456B6B] p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-[#456B6B]">
          Date
        </p>
        <div className="flex flex-wrap gap-8">
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
      </div>

      {/* Payments */}
      <QuotePaymentsSection quote={quote} />

      {/* Quote items table */}
      {quoteItems.length > 0 && (
        <div className="mx-4 mt-3 space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[#2C3E50]">
            Voci preventivo
          </p>
          <div className="overflow-hidden rounded-lg border">
            <div className="bg-[#E8EDF2] border-b border-[#2C3E50] px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#2C3E50]">
                  Descrizione
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#2C3E50]">
                  Importo
                </span>
              </div>
            </div>
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
                <p className="text-sm font-bold">
                  {getQuoteItemLineTotal(item).toLocaleString("it-IT", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejection reason */}
      {quote.rejection_reason && (
        <div className="mx-4 mt-3 rounded-lg border border-l-[3px] border-l-red-400 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-red-600">
            Motivo rifiuto
          </p>
          <p className="text-sm">{quote.rejection_reason}</p>
        </div>
      )}

      {/* Notes */}
      {quote.notes && (
        <div className="mx-4 mt-3 rounded-lg border border-l-[3px] border-l-[#456B6B] p-4 whitespace-pre-line">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#456B6B]">
            Note
          </p>
          <p className="text-sm leading-6">{quote.notes}</p>
        </div>
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
