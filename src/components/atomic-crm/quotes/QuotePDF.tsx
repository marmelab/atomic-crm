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

// ── Palette — Navy & Petrolio ─────────────────────────────────────
const c = {
  ink: "#1C1C1E", // near-black — headings, primary text
  body: "#3A3A3C", // dark gray — body text
  mid: "#8E8E93", // medium gray — labels, secondary
  rule: "#D1D1D6", // light gray — table lines
  faint: "#F2F2F7", // very light — neutral background
  navy: "#2C3E50", // dark blue-gray — primary accent
  navyLight: "#E8EDF2", // navy wash — tinted backgrounds
  petrol: "#456B6B", // deep teal — secondary accent
  white: "#FFFFFF",
};

const PX = 48; // page horizontal padding

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 0,
    paddingBottom: 60,
    backgroundColor: c.white,
    color: c.body,
  },

  // ── Header ─────────────────────────────────────────────────────
  header: {
    paddingHorizontal: PX,
    paddingTop: 32,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    backgroundColor: c.white,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  brandName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: c.ink,
    letterSpacing: 0.3,
  },
  brandTagline: {
    fontSize: 7,
    color: c.mid,
    marginTop: 4,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  headerRight: {
    alignItems: "flex-end" as const,
  },
  docTypeBadge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: "#FEF2F2",
    alignSelf: "flex-end" as const,
  },
  docTypeText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#B91C1C",
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  docNumber: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: c.ink,
    marginTop: 2,
  },
  docStatusBadge: {
    marginTop: 6,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 4,
    alignSelf: "flex-end" as const,
  },
  docStatusText: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  },

  // ── Info cards ─────────────────────────────────────────────────
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    gap: 12,
    paddingHorizontal: PX,
    paddingTop: 14,
  },
  infoCard: {
    width: "48%",
    padding: 10,
    backgroundColor: c.white,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: c.rule,
    borderLeftWidth: 3,
    borderLeftColor: c.navy,
  },
  infoLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: c.navy,
    textTransform: "uppercase" as const,
    letterSpacing: 2,
    marginBottom: 5,
  },
  infoName: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: c.ink,
    lineHeight: 1.5,
  },
  infoText: {
    fontSize: 10,
    lineHeight: 1.7,
    color: c.body,
  },

  // ── Table ──────────────────────────────────────────────────────
  table: {
    marginBottom: 0,
    borderWidth: 0.5,
    borderColor: c.rule,
    borderRadius: 10,
    overflow: "hidden",
    marginHorizontal: PX,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 0,
    backgroundColor: c.navyLight,
    borderBottomWidth: 1,
    borderBottomColor: c.navy,
  },
  tableHeaderText: {
    color: c.navy,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase" as const,
    letterSpacing: 1.5,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: c.rule,
  },
  colDesc: { width: "50%" },
  colType: { width: "28%" },
  colAmount: { width: "22%", textAlign: "right" as const },

  // ── Total hero (email-inspired) ─────────────────────────────────
  totalHero: {
    marginTop: 8,
    marginHorizontal: PX,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: c.navyLight,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 16,
  },
  totalLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: c.navy,
    textTransform: "uppercase" as const,
    letterSpacing: 2,
  },
  totalAmount: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: c.ink,
    letterSpacing: -0.3,
  },

  // ── Notes ──────────────────────────────────────────────────────
  notesSection: {
    marginTop: 14,
    marginHorizontal: PX,
    padding: 10,
    backgroundColor: c.white,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: c.rule,
    borderLeftWidth: 3,
    borderLeftColor: c.petrol,
  },
  notesTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: c.petrol,
    textTransform: "uppercase" as const,
    letterSpacing: 2,
    marginBottom: 6,
  },
  notesText: {
    fontSize: 10,
    lineHeight: 1.7,
    color: c.body,
  },

  // ── Footer ─────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    paddingHorizontal: PX,
  },
  footerLine: {
    height: 1,
    backgroundColor: c.rule,
    marginBottom: 10,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 3,
  },
  footerItem: {
    fontSize: 6.5,
    color: c.mid,
  },
  footerSep: {
    fontSize: 6.5,
    color: c.rule,
  },
});

// ── Status colors (aligned with email templates) ─────────────────
const statusColors: Record<string, { bg: string; text: string }> = {
  primo_contatto: { bg: "#f1f5f9", text: "#334155" },
  preventivo_inviato: { bg: "#eff6ff", text: "#1e40af" },
  in_trattativa: { bg: "#fffbeb", text: "#92400e" },
  accettato: { bg: "#f0fdf4", text: "#166534" },
  acconto_ricevuto: { bg: "#f0fdfa", text: "#115e59" },
  in_lavorazione: { bg: "#f5f3ff", text: "#5b21b6" },
  completato: { bg: "#f0f9ff", text: "#075985" },
  saldato: { bg: "#ecfdf5", text: "#065f46" },
  rifiutato: { bg: "#fef2f2", text: "#991b1b" },
  perso: { bg: "#fafaf9", text: "#57534e" },
};
const defaultStatusColor = { bg: "#f1f5f9", text: "#334155" };

const getStatusColor = (status?: string) =>
  (status && statusColors[status]) || defaultStatusColor;

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
            <View style={styles.docTypeBadge}>
              <Text style={styles.docTypeText}>Preventivo</Text>
            </View>
            <Text style={styles.docNumber}>
              {fmtQuoteId(String(quote.id))}
            </Text>
            <View
              style={[
                styles.docStatusBadge,
                { backgroundColor: getStatusColor(quote.status).bg },
              ]}
            >
              <Text
                style={[
                  styles.docStatusText,
                  { color: getStatusColor(quote.status).text },
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Body ────────────────────────────────────────────── */}
          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Cliente</Text>
              <Text style={styles.infoName}>
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
            <View
              style={[
                styles.infoCard,
                { borderLeftColor: c.petrol },
              ]}
            >
              <Text style={[styles.infoLabel, { color: c.petrol }]}>
                Date
              </Text>
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

          {/* ── Table ─────────────────────────────────────────── */}
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
                  style={styles.tableRow}
                  key={`${item.description}-${index}`}
                >
                  <Text style={[{ fontSize: 11 }, styles.colDesc]}>
                    {item.description}
                  </Text>
                  <Text
                    style={[{ fontSize: 10, color: c.mid }, styles.colType]}
                  >
                    {serviceLabel} · {item.quantity} ×{" "}
                    {fmtCurrency(item.unit_price)}
                  </Text>
                  <Text
                    style={[
                      { fontSize: 11, fontFamily: "Helvetica-Bold" },
                      styles.colAmount,
                    ]}
                  >
                    {fmtCurrency(getQuoteItemLineTotal(item))}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.tableRow}>
                <Text style={[{ fontSize: 11 }, styles.colDesc]}>
                  {quote.description || "Servizio professionale"}
                </Text>
                <Text
                  style={[{ fontSize: 10, color: c.mid }, styles.colType]}
                >
                  {serviceLabel}
                </Text>
                <Text
                  style={[
                    { fontSize: 11, fontFamily: "Helvetica-Bold" },
                    styles.colAmount,
                  ]}
                >
                  {fmtCurrency(quote.amount)}
                </Text>
              </View>
            )}
          </View>

          {/* ── Total hero — come l'email ────────────────────── */}
          <View style={styles.totalHero}>
            <Text style={styles.totalLabel}>Totale</Text>
            <Text style={styles.totalAmount}>
              {fmtCurrency(quote.amount)}
            </Text>
          </View>

          {/* ── Notes ─────────────────────────────────────────── */}
          {quote.notes && (
            <View style={styles.notesSection}>
              <Text style={styles.notesTitle}>Note</Text>
              <Text style={styles.notesText}>{quote.notes}</Text>
            </View>
          )}

        {/* ── Footer ──────────────────────────────────────────── */}
        <View style={styles.footer}>
          <View style={styles.footerLine} />
          <View style={styles.footerRow}>
            {[
              businessProfile.address,
              businessProfile.email,
              businessProfile.phone,
            ]
              .filter(Boolean)
              .map((item, i, arr) => (
                <Text key={item} style={styles.footerItem}>
                  {item}
                  {i < arr.length - 1 ? "  ·  " : ""}
                </Text>
              ))}
          </View>
          <View style={styles.footerRow}>
            {[
              businessProfile.vatNumber
                ? `P.IVA ${businessProfile.vatNumber}`
                : "",
              businessProfile.fiscalCode
                ? `CF ${businessProfile.fiscalCode}`
                : "",
              businessProfile.sdiCode
                ? `SDI ${businessProfile.sdiCode}`
                : "",
              businessProfile.iban
                ? `IBAN ${businessProfile.iban}`
                : "",
            ]
              .filter(Boolean)
              .map((item, i, arr) => (
                <Text key={item} style={styles.footerItem}>
                  {item}
                  {i < arr.length - 1 ? "  ·  " : ""}
                </Text>
              ))}
          </View>
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
