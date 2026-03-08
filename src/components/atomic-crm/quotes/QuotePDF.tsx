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
  primary: "#1e293b", // slate-800 — solid, readable
  accent: "#334155", // slate-700 — understated, versatile
  accentSoft: "#f1f5f9", // slate-100 — subtle tint
  gold: "#92400e", // amber-800 — warm but serious for totals
  muted: "#64748b", // slate-500
  light: "#f8fafc", // slate-50
  white: "#ffffff",
  border: "#e2e8f0", // slate-200
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 0,
    paddingBottom: 60,
    paddingHorizontal: 0,
    color: colors.primary,
  },
  // Top accent band
  topBand: {
    height: 6,
    backgroundColor: colors.accent,
  },
  content: {
    paddingHorizontal: 44,
    paddingTop: 28,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 28,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  brandName: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    letterSpacing: 0.3,
  },
  brandTagline: {
    fontSize: 8.5,
    color: colors.accent,
    marginTop: 3,
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
  },
  brandDetail: {
    fontSize: 8,
    color: colors.muted,
    marginTop: 1.5,
  },
  headerRight: {
    alignItems: "flex-end" as const,
  },
  quoteLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.accent,
    textTransform: "uppercase" as const,
    letterSpacing: 2.5,
  },
  quoteNumber: {
    fontSize: 9,
    color: colors.muted,
    textAlign: "right" as const,
    marginTop: 4,
  },
  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 24,
  },
  // Two-column info
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  infoBlock: {
    width: "48%",
  },
  infoLabel: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: colors.accent,
    textTransform: "uppercase" as const,
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  infoText: {
    fontSize: 9.5,
    lineHeight: 1.6,
    color: colors.primary,
  },
  infoBold: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.6,
    color: colors.primary,
  },
  // Details table
  table: {
    marginTop: 4,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.accentSoft,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.accent,
  },
  tableHeaderText: {
    color: colors.accent,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    backgroundColor: colors.light,
  },
  colDesc: { width: "55%" },
  colType: { width: "25%" },
  colAmount: { width: "20%", textAlign: "right" as const },
  // Total
  totalContainer: {
    marginTop: 8,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.accentSoft,
    borderRadius: 4,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.muted,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginRight: 20,
  },
  totalAmount: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: colors.gold,
    letterSpacing: 0.5,
  },
  // Notes section
  notesSection: {
    marginTop: 24,
    padding: 14,
    backgroundColor: colors.light,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  notesTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: colors.accent,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 9,
    lineHeight: 1.7,
    color: colors.primary,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    paddingHorizontal: 44,
  },
  footerDivider: {
    height: 0.5,
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
export interface QuotePDFProps {
  quote: Quote;
  client?: Client;
  serviceLabel: string;
  statusLabel: string;
  quoteItems?: QuoteItem[];
  businessProfile: BusinessProfile;
}

export const QuotePDFDocument = ({
  quote,
  client,
  serviceLabel,
  statusLabel,
  quoteItems,
  businessProfile,
}: QuotePDFProps) => {
  const items = sanitizeQuoteItems(quoteItems ?? quote.quote_items);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Top accent band */}
        <View style={styles.topBand} />

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image style={styles.logo} src={LOGO_URL} />
              <View>
                <Text style={styles.brandName}>{businessProfile.name}</Text>
                <Text style={styles.brandTagline}>
                  {businessProfile.tagline}
                </Text>
                {businessProfile.address && (
                  <Text style={styles.brandDetail}>
                    {businessProfile.address}
                  </Text>
                )}
                {businessProfile.email && (
                  <Text style={styles.brandDetail}>
                    {businessProfile.email}
                  </Text>
                )}
                {businessProfile.phone && (
                  <Text style={styles.brandDetail}>
                    {businessProfile.phone}
                  </Text>
                )}
              </View>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.quoteLabel}>Preventivo</Text>
              <Text style={styles.quoteNumber}>
                {fmtQuoteId(String(quote.id))}
              </Text>
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
              {client?.email && (
                <Text style={styles.infoText}>{client.email}</Text>
              )}
              {client?.phone && (
                <Text style={styles.infoText}>{client.phone}</Text>
              )}
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
            {items.length > 0 ? (
              items.map((item, index) => (
                <View
                  style={[
                    styles.tableRow,
                    index % 2 === 1 ? styles.tableRowAlt : {},
                  ]}
                  key={`${item.description}-${index}`}
                >
                  <Text style={[{ fontSize: 9.5 }, styles.colDesc]}>
                    {item.description}
                  </Text>
                  <Text style={[{ fontSize: 9.5 }, styles.colType]}>
                    {serviceLabel} · {item.quantity} ×{" "}
                    {fmtCurrency(item.unit_price)}
                  </Text>
                  <Text
                    style={[
                      { fontSize: 9.5, fontFamily: "Helvetica-Bold" },
                      styles.colAmount,
                    ]}
                  >
                    {fmtCurrency(getQuoteItemLineTotal(item))}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.tableRow}>
                <Text style={[{ fontSize: 9.5 }, styles.colDesc]}>
                  {quote.description || "Servizio professionale"}
                </Text>
                <Text style={[{ fontSize: 9.5 }, styles.colType]}>
                  {serviceLabel}
                </Text>
                <Text
                  style={[
                    { fontSize: 9.5, fontFamily: "Helvetica-Bold" },
                    styles.colAmount,
                  ]}
                >
                  {fmtCurrency(quote.amount)}
                </Text>
              </View>
            )}
          </View>

          {/* Total */}
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Totale</Text>
            <Text style={styles.totalAmount}>{fmtCurrency(quote.amount)}</Text>
          </View>

          {/* Notes */}
          {quote.notes && (
            <View style={styles.notesSection}>
              <Text style={styles.notesTitle}>Note</Text>
              <Text style={styles.notesText}>{quote.notes}</Text>
            </View>
          )}
        </View>

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
            {businessProfile.address ? ` · ${businessProfile.address}` : ""}
            {businessProfile.email ? ` · ${businessProfile.email}` : ""}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

// ── Filename helper ───────────────────────────────────────────────
export const getQuotePdfFilename = (props: QuotePDFProps) => {
  const clientName = props.client?.name?.replace(/\s+/g, "_") ?? "cliente";
  return `Preventivo_${clientName}_${fmtQuoteId(String(props.quote.id))}.pdf`;
};

// ── Download helper ───────────────────────────────────────────────
export const downloadQuotePDF = async (props: QuotePDFProps) => {
  const blob = await pdf(<QuotePDFDocument {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getQuotePdfFilename(props);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ── Base64 helper (for email attachment) ──────────────────────────
export const generateQuotePdfBase64 = async (
  props: QuotePDFProps,
): Promise<{ base64: string; filename: string }> => {
  const blob = await pdf(<QuotePDFDocument {...props} />).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return {
    base64: btoa(binary),
    filename: getQuotePdfFilename(props),
  };
};
