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

// ── Palette — Slate & Gold Minimal ────────────────────────────────
const colors = {
  ivory: "#F5F2EC", // warm ivory background
  gold: "#D1B280", // muted gold — accents, lines, totals
  slate: "#72675A", // warm slate — secondary text, separators
  charcoal: "#3B3F46", // soft charcoal — primary text
  heading: "#15181C", // near-black — headings only
  light: "#EDE9E3", // ivory darker — alt rows
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 0,
    paddingBottom: 56,
    backgroundColor: colors.white,
    color: colors.charcoal,
  },
  // ── Header ─────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 48,
    paddingTop: 40,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  brandName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: colors.heading,
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: 7.5,
    color: colors.slate,
    marginTop: 3,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  headerRight: {
    alignItems: "flex-end" as const,
  },
  quoteLabel: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: colors.heading,
    letterSpacing: 1,
  },
  quoteNumber: {
    fontSize: 8.5,
    color: colors.slate,
    textAlign: "right" as const,
    marginTop: 4,
  },
  // ── Gold line ──────────────────────────────────────────────────
  goldLine: {
    height: 1.5,
    backgroundColor: colors.gold,
    marginHorizontal: 48,
  },
  // ── Details bar ────────────────────────────────────────────────
  detailsBar: {
    paddingVertical: 8,
    paddingHorizontal: 48,
  },
  detailsBarText: {
    fontSize: 7,
    color: colors.slate,
    textAlign: "center" as const,
    letterSpacing: 0.3,
  },
  // ── Content ────────────────────────────────────────────────────
  content: {
    paddingHorizontal: 48,
    paddingTop: 16,
  },
  // ── Info columns ───────────────────────────────────────────────
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  infoBlock: {
    width: "48%",
  },
  infoLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: colors.gold,
    textTransform: "uppercase" as const,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  infoText: {
    fontSize: 9.5,
    lineHeight: 1.6,
    color: colors.charcoal,
  },
  infoBold: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.6,
    color: colors.heading,
  },
  // ── Table ──────────────────────────────────────────────────────
  table: {
    marginBottom: 0,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: colors.gold,
    paddingBottom: 8,
    marginBottom: 0,
  },
  tableHeaderText: {
    color: colors.slate,
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.light,
  },
  tableRowAlt: {},
  colDesc: { width: "55%" },
  colType: { width: "25%" },
  colAmount: { width: "20%", textAlign: "right" as const },
  // ── Total ──────────────────────────────────────────────────────
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: colors.gold,
  },
  totalLabel: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: colors.slate,
    textTransform: "uppercase" as const,
    letterSpacing: 1.5,
    marginRight: 20,
  },
  totalAmount: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: colors.heading,
  },
  // ── Notes ──────────────────────────────────────────────────────
  notesSection: {
    marginTop: 28,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: colors.light,
  },
  notesTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: colors.gold,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 9,
    lineHeight: 1.7,
    color: colors.charcoal,
  },
  // ── Footer ─────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    paddingHorizontal: 48,
  },
  footerLine: {
    height: 1,
    backgroundColor: colors.gold,
    marginBottom: 8,
    opacity: 0.4,
  },
  footerText: {
    fontSize: 7,
    color: colors.slate,
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

  const detailsParts = [
    businessProfile.address,
    businessProfile.email,
    businessProfile.phone,
    businessProfile.vatNumber ? `P.IVA ${businessProfile.vatNumber}` : "",
    businessProfile.fiscalCode ? `CF ${businessProfile.fiscalCode}` : "",
    businessProfile.sdiCode ? `SDI ${businessProfile.sdiCode}` : "",
    businessProfile.iban ? `IBAN ${businessProfile.iban}` : "",
  ].filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image style={styles.logo} src={LOGO_URL} />
            <View>
              <Text style={styles.brandName}>{businessProfile.name}</Text>
              <Text style={styles.brandTagline}>
                {businessProfile.tagline}
              </Text>
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

        {/* ── Gold line ───────────────────────────────────────── */}
        <View style={styles.goldLine} />

        {/* ── Business details ────────────────────────────────── */}
        <View style={styles.detailsBar}>
          <Text style={styles.detailsBarText}>
            {detailsParts.join("  ·  ")}
          </Text>
        </View>

        {/* ── Body ────────────────────────────────────────────── */}
        <View style={styles.content}>
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

          {/* Table */}
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
                  style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
                  key={`${item.description}-${index}`}
                >
                  <Text style={[{ fontSize: 9.5 }, styles.colDesc]}>
                    {item.description}
                  </Text>
                  <Text style={[{ fontSize: 9.5, color: colors.slate }, styles.colType]}>
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
                <Text style={[{ fontSize: 9.5, color: colors.slate }, styles.colType]}>
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
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Totale</Text>
            <Text style={styles.totalAmount}>
              {fmtCurrency(quote.amount)}
            </Text>
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
          <View style={styles.footerLine} />
          <Text style={styles.footerText}>
            {businessProfile.name}
            {businessProfile.vatNumber
              ? ` · P.IVA ${businessProfile.vatNumber}`
              : ""}
            {businessProfile.sdiCode
              ? ` · SDI ${businessProfile.sdiCode}`
              : ""}
            {businessProfile.iban ? ` · IBAN ${businessProfile.iban}` : ""}
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
