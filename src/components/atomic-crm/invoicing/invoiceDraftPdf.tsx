import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";

import {
  formatClientBillingAddress,
  getClientBillingDisplayName,
} from "../clients/clientBilling";
import type { Client } from "../types";
import {
  computeInvoiceDraftTotals,
  getInvoiceDraftLineTotal,
  normalizeInvoiceDraftLineItems,
  type InvoiceDraftInput,
} from "./invoiceDraftTypes";

export type InvoiceDraftIssuer = {
  name: string;
  tagline?: string;
  vatNumber?: string;
  fiscalCode?: string;
  address?: string;
  email?: string;
  phone?: string;
};

const defaultIssuer: InvoiceDraftIssuer = {
  name: "Rosario Furnari",
};

const LOGO_URL = "/logos/logo_rosario_furnari.png";

// ── Colors (same palette as QuotePDF) ──────────────────────────────
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
    position: "relative",
  },
  watermark: {
    position: "absolute",
    top: "42%",
    left: "10%",
    right: "10%",
    textAlign: "center",
    fontSize: 28,
    color: "#dddddd",
    transform: "rotate(-20deg)",
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
  docLabel: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: colors.accent,
    textAlign: "right" as const,
  },
  docSubLabel: {
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
  // Table
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
    alignItems: "center",
  },
  cDescription: { width: "50%" },
  cQty: { width: "12%", textAlign: "right" as const },
  cUnit: { width: "19%", textAlign: "right" as const },
  cTotal: { width: "19%", textAlign: "right" as const },
  // Total
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
    paddingTop: 12,
    paddingRight: 10,
    gap: 16,
  },
  totalLabel: {
    width: 120,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: colors.primary,
    textAlign: "right" as const,
  },
  totalAmount: {
    width: 80,
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: colors.accent,
    textAlign: "right" as const,
  },
  subtotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingRight: 10,
    gap: 16,
    marginTop: 2,
  },
  subtotalLabel: {
    width: 120,
    fontSize: 10,
    color: colors.muted,
    textAlign: "right" as const,
  },
  subtotalValue: {
    width: 80,
    fontSize: 10,
    textAlign: "right" as const,
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

const formatAmount = (value: number) =>
  value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const clientFiscalLines = (client: Client) =>
  [
    client.vat_number ? `P.IVA ${client.vat_number}` : null,
    client.fiscal_code ? `CF ${client.fiscal_code}` : null,
    client.billing_sdi_code ? `SDI ${client.billing_sdi_code}` : null,
    client.billing_pec ? `PEC ${client.billing_pec}` : null,
  ].filter((line): line is string => Boolean(line));

const InvoiceDraftPdfDocument = ({
  draft,
  issuer,
}: {
  draft: InvoiceDraftInput;
  issuer: InvoiceDraftIssuer;
}) => {
  const lineItems = normalizeInvoiceDraftLineItems(draft.lineItems);
  const totals = computeInvoiceDraftTotals(lineItems);
  const clientName =
    getClientBillingDisplayName(draft.client) ?? draft.client.name;
  const clientAddress = formatClientBillingAddress(draft.client);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.watermark}>BOZZA - NON VALIDA AI FINI FISCALI</Text>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image style={styles.logo} src={LOGO_URL} />
            <View>
              <Text style={styles.brandName}>{issuer.name}</Text>
              {issuer.tagline && (
                <Text style={styles.brandTagline}>{issuer.tagline}</Text>
              )}
              {issuer.address && (
                <Text style={styles.brandDetail}>{issuer.address}</Text>
              )}
              {issuer.email && (
                <Text style={styles.brandDetail}>{issuer.email}</Text>
              )}
              {issuer.phone && (
                <Text style={styles.brandDetail}>{issuer.phone}</Text>
              )}
            </View>
          </View>
          <View>
            <Text style={styles.docLabel}>BOZZA</Text>
            <Text style={styles.docSubLabel}>FATTURA</Text>
            <Text style={styles.docSubLabel}>
              Data: {draft.invoiceDate ?? todayIsoDate()}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Client & Document info */}
        <View style={styles.infoRow}>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Cliente</Text>
            <Text style={styles.infoBold}>{clientName}</Text>
            {clientAddress ? (
              <Text style={styles.infoText}>{clientAddress}</Text>
            ) : null}
            {clientFiscalLines(draft.client).map((line) => (
              <Text key={line} style={styles.infoText}>
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.infoBlock}>
            <Text style={styles.infoLabel}>Dati documento</Text>
            <Text style={styles.infoText}>
              Data: {draft.invoiceDate ?? todayIsoDate()}
            </Text>
            <Text style={styles.infoText}>
              Origine: {draft.source.kind} - {draft.source.label}
            </Text>
          </View>
        </View>

        {/* Line items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.cDescription]}>
              Descrizione
            </Text>
            <Text style={[styles.tableHeaderText, styles.cQty]}>Q.tà</Text>
            <Text style={[styles.tableHeaderText, styles.cUnit]}>
              Prezzo unit.
            </Text>
            <Text style={[styles.tableHeaderText, styles.cTotal]}>Totale</Text>
          </View>

          {lineItems.map((lineItem, index) => (
            <View
              key={`${lineItem.description}-${index}`}
              style={styles.tableRow}
            >
              <Text style={[{ fontSize: 10 }, styles.cDescription]}>
                {lineItem.description}
              </Text>
              <Text style={[{ fontSize: 10 }, styles.cQty]}>
                {lineItem.quantity}
              </Text>
              <Text style={[{ fontSize: 10 }, styles.cUnit]}>
                {formatAmount(lineItem.unitPrice)}
              </Text>
              <Text style={[{ fontSize: 10 }, styles.cTotal]}>
                {formatAmount(getInvoiceDraftLineTotal(lineItem))}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>Totale imponibile</Text>
          <Text style={styles.subtotalValue}>
            {formatAmount(totals.taxableAmount)}
          </Text>
        </View>
        {totals.stampDuty > 0 ? (
          <View style={styles.subtotalRow}>
            <Text style={styles.subtotalLabel}>Bollo</Text>
            <Text style={styles.subtotalValue}>
              {formatAmount(totals.stampDuty)}
            </Text>
          </View>
        ) : null}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTALE</Text>
          <Text style={styles.totalAmount}>
            {formatAmount(totals.totalAmount)}
          </Text>
        </View>

        {/* Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.notesTitle}>Note</Text>
          <Text style={styles.notesText}>
            Operazione effettuata ai sensi dell'art. 1 commi 54-89 L. 190/2014
          </Text>
          {draft.notes ? (
            <Text style={styles.notesText}>{draft.notes}</Text>
          ) : null}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <Text style={styles.footerText}>
            {issuer.name}
            {issuer.vatNumber ? ` · P.IVA ${issuer.vatNumber}` : ""}
            {issuer.fiscalCode ? ` · CF ${issuer.fiscalCode}` : ""}
            {issuer.address ? ` · ${issuer.address}` : ""}
            {issuer.email ? ` · ${issuer.email}` : ""}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

export const downloadInvoiceDraftPdf = async ({
  draft,
  issuer = defaultIssuer,
}: {
  draft: InvoiceDraftInput;
  issuer?: InvoiceDraftIssuer;
}) => {
  const pdfDocument = <InvoiceDraftPdfDocument draft={draft} issuer={issuer} />;
  const blob = await pdf(pdfDocument).toBlob();
  const objectUrl = URL.createObjectURL(blob);

  const anchor = window.document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `bozza-fattura-${String(draft.source.id)}.pdf`;
  anchor.click();

  URL.revokeObjectURL(objectUrl);
};
