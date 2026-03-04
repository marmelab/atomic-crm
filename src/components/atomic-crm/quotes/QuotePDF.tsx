import {
  Document,
  Image,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { format, isValid } from "date-fns";
import { it } from "date-fns/locale";
import type { BusinessProfile, Quote, Client, QuoteItem } from "../types";
import {
  formatClientBillingAddress,
  getClientBillingDisplayName,
  getClientBillingIdentityLines,
} from "../clients/clientBilling";
import { formatDateLong } from "../misc/formatDateRange";
import { getQuoteItemLineTotal, sanitizeQuoteItems } from "./quoteItems";

const LOGO_URL = "/logos/logo_rosario_furnari.png";

// ── Styles ────────────────────────────────────────────────────────
const colors = {
  primary: "#1a1a2e",
  accent: "#e94560",
  muted: "#64748b",
  light: "#f1f5f9",
  white: "#ffffff",
  border: "#e2e8f0",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: colors.primary,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  brandName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
  },
  brandTagline: {
    fontSize: 9,
    color: colors.muted,
    marginTop: 2,
  },
  brandDetail: {
    fontSize: 8,
    color: colors.muted,
    marginTop: 1,
  },
  quoteLabel: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: colors.accent,
    textAlign: "right" as const,
  },
  quoteNumber: {
    fontSize: 9,
    color: colors.muted,
    textAlign: "right" as const,
    marginTop: 4,
  },
  // Divider
  divider: {
    height: 2,
    backgroundColor: colors.accent,
    marginBottom: 24,
  },
  // Two-column info
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  infoBlock: {
    width: "48%",
  },
  infoLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.muted,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 10,
    lineHeight: 1.5,
  },
  infoBold: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.5,
  },
  // Details table
  table: {
    marginTop: 8,
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.primary,
    padding: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderText: {
    color: colors.white,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  colDesc: { width: "55%" },
  colType: { width: "25%" },
  colAmount: { width: "20%", textAlign: "right" as const },
  // Total
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
    paddingTop: 12,
    paddingRight: 10,
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    marginRight: 24,
  },
  totalAmount: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.accent,
  },
  // Notes section
  notesSection: {
    marginTop: 20,
    padding: 12,
    backgroundColor: colors.light,
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.muted,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 9,
    lineHeight: 1.6,
    color: colors.primary,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
  },
  footerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  footerText: {
    fontSize: 7,
    color: colors.muted,
    textAlign: "center" as const,
    lineHeight: 1.6,
  },
});

// ── Helpers ───────────────────────────────────────────────────────
const fmtDate = (d?: string) => {
  if (!d) return "—";
  const date = new Date(d);
  return isValid(date) ? format(date, "dd MMMM yyyy", { locale: it }) : "—";
};

const fmtCurrency = (n: number) =>
  n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

const fmtQuoteId = (id: string) => {
  const short = typeof id === "string" ? id.slice(0, 8).toUpperCase() : "—";
  return `PRV-${short}`;
};

// ── PDF Document ──────────────────────────────────────────────────
interface QuotePDFProps {
  quote: Quote;
  client?: Client;
  serviceLabel: string;
  statusLabel: string;
  quoteItems?: QuoteItem[];
  businessProfile: BusinessProfile;
}

const QuotePDFDocument = ({
  quote,
  client,
  serviceLabel,
  statusLabel,
  businessProfile,
}: QuotePDFProps) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image style={styles.logo} src={LOGO_URL} />
          <View>
            <Text style={styles.brandName}>{businessProfile.name}</Text>
            <Text style={styles.brandTagline}>{businessProfile.tagline}</Text>
            {businessProfile.address && (
              <Text style={styles.brandDetail}>{businessProfile.address}</Text>
            )}
            {businessProfile.email && (
              <Text style={styles.brandDetail}>{businessProfile.email}</Text>
            )}
            {businessProfile.phone && (
              <Text style={styles.brandDetail}>{businessProfile.phone}</Text>
            )}
          </View>
        </View>
        <View>
          <Text style={styles.quoteLabel}>PREVENTIVO</Text>
          <Text style={styles.quoteNumber}>{fmtQuoteId(String(quote.id))}</Text>
          <Text style={styles.quoteNumber}>Stato: {statusLabel}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Client & Dates */}
      <View style={styles.infoRow}>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Cliente</Text>
          <Text style={styles.infoBold}>
            {getClientBillingDisplayName(client) ?? client?.name ?? "—"}
          </Text>
          {formatClientBillingAddress(client) && (
            <Text style={styles.infoText}>
              {formatClientBillingAddress(client)}
            </Text>
          )}
          {client?.email && <Text style={styles.infoText}>{client.email}</Text>}
          {client?.phone && <Text style={styles.infoText}>{client.phone}</Text>}
          {getClientBillingIdentityLines(client).map((line) => (
            <Text key={line} style={styles.infoText}>
              {line}
            </Text>
          ))}
        </View>
        <View style={styles.infoBlock}>
          <Text style={styles.infoLabel}>Date</Text>
          <Text style={styles.infoText}>
            Emissione: {fmtDate(quote.created_at)}
          </Text>
          {quote.event_start && (
            <Text style={styles.infoText}>
              Evento:{" "}
              {formatDateLong(
                quote.event_start,
                quote.event_end,
                quote.all_day,
              )}
            </Text>
          )}
          {quote.sent_date && (
            <Text style={styles.infoText}>
              Invio: {fmtDate(quote.sent_date)}
            </Text>
          )}
          {quote.response_date && (
            <Text style={styles.infoText}>
              Risposta: {fmtDate(quote.response_date)}
            </Text>
          )}
        </View>
      </View>

      {/* Service table */}
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colDesc]}>
            Descrizione
          </Text>
          <Text style={[styles.tableHeaderText, styles.colType]}>
            Dettaglio
          </Text>
          <Text style={[styles.tableHeaderText, styles.colAmount]}>
            Importo
          </Text>
        </View>
        {sanitizeQuoteItems(quoteItems ?? quote.quote_items).length > 0 ? (
          sanitizeQuoteItems(quoteItems ?? quote.quote_items).map(
            (item, index) => (
              <View
                style={styles.tableRow}
                key={`${item.description}-${index}`}
              >
                <Text style={[{ fontSize: 10 }, styles.colDesc]}>
                  {item.description}
                </Text>
                <Text style={[{ fontSize: 10 }, styles.colType]}>
                  {serviceLabel} · {item.quantity} ×{" "}
                  {fmtCurrency(item.unit_price)}
                </Text>
                <Text style={[{ fontSize: 10 }, styles.colAmount]}>
                  {fmtCurrency(getQuoteItemLineTotal(item))}
                </Text>
              </View>
            ),
          )
        ) : (
          <View style={styles.tableRow}>
            <Text style={[{ fontSize: 10 }, styles.colDesc]}>
              {quote.description || "Servizio professionale"}
            </Text>
            <Text style={[{ fontSize: 10 }, styles.colType]}>
              {serviceLabel}
            </Text>
            <Text style={[{ fontSize: 10 }, styles.colAmount]}>
              {fmtCurrency(quote.amount)}
            </Text>
          </View>
        )}
      </View>

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>TOTALE</Text>
        <Text style={styles.totalAmount}>{fmtCurrency(quote.amount)}</Text>
      </View>

      {/* Notes */}
      {quote.notes && (
        <View style={styles.notesSection}>
          <Text style={styles.notesTitle}>Note</Text>
          <Text style={styles.notesText}>{quote.notes}</Text>
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerDivider} />
        <Text style={styles.footerText}>
          {businessProfile.name}
          {businessProfile.vatNumber
            ? ` · P.IVA ${businessProfile.vatNumber}`
            : ""}
          {businessProfile.fiscalCode
            ? ` · CF ${businessProfile.fiscalCode}`
            : ""}
          {businessProfile.address
            ? ` · ${businessProfile.address}`
            : ""}
          {businessProfile.email ? ` · ${businessProfile.email}` : ""}
        </Text>
      </View>
    </Page>
  </Document>
);

// ── Download helper ───────────────────────────────────────────────
export const downloadQuotePDF = async (props: QuotePDFProps) => {
  const blob = await pdf(<QuotePDFDocument {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const clientName = props.client?.name?.replace(/\s+/g, "_") ?? "cliente";
  link.download = `Preventivo_${clientName}_${fmtQuoteId(String(props.quote.id))}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
