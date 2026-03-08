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
  sdiCode?: string;
  iban?: string;
  bankName?: string;
  bic?: string;
  address?: string;
  email?: string;
  phone?: string;
};

const defaultIssuer: InvoiceDraftIssuer = {
  name: "Rosario Furnari",
};

const LOGO_URL = "/logos/logo_rosario_furnari.png";

// ── Palette — Navy & Petrolio (aligned with QuotePDF) ──────────────
const c = {
  ink: "#1C1C1E",
  body: "#3A3A3C",
  mid: "#8E8E93",
  rule: "#D1D1D6",
  navy: "#2C3E50",
  navyLight: "#E8EDF2",
  petrol: "#456B6B",
  white: "#FFFFFF",
};

const PX = 48;

const microLabel = {
  fontSize: 7,
  color: c.mid,
  textTransform: "uppercase" as const,
  letterSpacing: 1,
  marginBottom: 3,
} as const;

const boldVal = {
  fontSize: 9,
  fontFamily: "Helvetica-Bold",
  color: c.ink,
} as const;

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 0,
    paddingBottom: 60,
    backgroundColor: c.white,
    color: c.body,
  },
  header: {
    paddingHorizontal: PX,
    paddingTop: 32,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 16 },
  logo: { width: 52, height: 52, borderRadius: 26 },
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
  headerRight: { alignItems: "flex-end" as const },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 4,
    alignSelf: "flex-end" as const,
  },
  accentLine: {
    height: 2.5,
    backgroundColor: c.navy,
    marginHorizontal: PX,
    borderRadius: 1,
  },
  body: { paddingHorizontal: PX, paddingTop: 14 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  infoCard: {
    width: "48%",
    padding: 10,
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
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: c.ink,
    lineHeight: 1.5,
  },
  infoText: { fontSize: 9, lineHeight: 1.6, color: c.body },
  sectionHeading: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: c.navy,
    textTransform: "uppercase" as const,
    letterSpacing: 2,
    marginBottom: 6,
    marginTop: 14,
  },
  table: {
    borderWidth: 0.5,
    borderColor: c.rule,
    borderRadius: 10,
    overflow: "hidden",
  },
  tHead: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: c.navyLight,
    borderBottomWidth: 1,
    borderBottomColor: c.navy,
  },
  th: {
    color: c.navy,
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase" as const,
    letterSpacing: 1.5,
  },
  tRow: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: c.rule,
    alignItems: "center",
  },
  cNr: { width: "6%", textAlign: "center" as const },
  cDesc: { width: "40%" },
  cQty: { width: "10%", textAlign: "center" as const },
  cPrice: { width: "16%", textAlign: "right" as const },
  cAmt: { width: "16%", textAlign: "right" as const },
  cIva: { width: "12%", textAlign: "center" as const },
  card: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: c.rule,
    borderLeftWidth: 3,
    borderLeftColor: c.navy,
    marginBottom: 10,
  },
  totalHero: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: c.navyLight,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 16,
  },
  noteCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: c.rule,
    borderLeftWidth: 3,
    borderLeftColor: c.petrol,
  },
  noteTitle: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: c.petrol,
    textTransform: "uppercase" as const,
    letterSpacing: 2,
    marginBottom: 6,
  },
  noteText: { fontSize: 9, lineHeight: 1.6, color: c.body },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    paddingHorizontal: PX,
  },
  footerLine: { height: 1, backgroundColor: c.rule, marginBottom: 8 },
  footerText: {
    fontSize: 6.5,
    color: c.mid,
    textAlign: "center" as const,
    lineHeight: 1.6,
  },
});

const fmt = (v: number) =>
  v.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

const todayIso = () => new Date().toISOString().slice(0, 10);

const clientFiscalLines = (client: Client) =>
  [
    client.vat_number ? `P.IVA ${client.vat_number}` : null,
    client.fiscal_code ? `C.F.: ${client.fiscal_code}` : null,
    client.billing_sdi_code
      ? `Codice destinatario: ${client.billing_sdi_code}`
      : null,
    client.billing_pec ? `PEC: ${client.billing_pec}` : null,
  ].filter((l): l is string => Boolean(l));

const STAMP_DUTY_DESC =
  "Imposta di bollo assolta in modo virtuale ai sensi dell'art. 15 del D.P.R. 642/1972 e del DM 17/06/2014";

// ── PDF Document ──────────────────────────────────────────────────
const InvoiceDraftPdfDocument = ({
  draft,
  issuer,
}: {
  draft: InvoiceDraftInput;
  issuer: InvoiceDraftIssuer;
}) => {
  const lines = normalizeInvoiceDraftLineItems(draft.lineItems);
  const totals = computeInvoiceDraftTotals(lines);
  const clientName =
    getClientBillingDisplayName(draft.client) ?? draft.client.name;
  const clientAddr = formatClientBillingAddress(draft.client);
  const hasStamp = totals.stampDuty > 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image style={styles.logo} src={LOGO_URL} />
            <View>
              <Text style={styles.brandName}>{issuer.name}</Text>
              {issuer.tagline ? (
                <Text style={styles.brandTagline}>{issuer.tagline}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.badge, { backgroundColor: c.navyLight }]}>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: c.navy, letterSpacing: 2, textTransform: "uppercase" as const }}>
                Fattura
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: "#FEF2F2", marginTop: 6 }]}>
              <Text style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#B91C1C", letterSpacing: 1, textTransform: "uppercase" as const }}>
                Bozza
              </Text>
            </View>
            <Text style={{ fontSize: 8, color: c.mid, marginTop: 4, textAlign: "right" as const }}>
              Data: {draft.invoiceDate ?? todayIso()}
            </Text>
          </View>
        </View>

        <View style={styles.accentLine} />

        <View style={styles.body}>
          {/* ── FORNITORE | CLIENTE ────────────────────────── */}
          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Fornitore</Text>
              <Text style={styles.infoName}>{issuer.name}</Text>
              {issuer.vatNumber ? <Text style={styles.infoText}>P.IVA: IT{issuer.vatNumber}</Text> : null}
              {issuer.fiscalCode ? <Text style={styles.infoText}>C.F.: {issuer.fiscalCode}</Text> : null}
              {issuer.address ? <Text style={styles.infoText}>{issuer.address}</Text> : null}
              {issuer.phone ? <Text style={styles.infoText}>Telefono: {issuer.phone}</Text> : null}
              {issuer.email ? <Text style={styles.infoText}>{issuer.email}</Text> : null}
            </View>
            <View style={[styles.infoCard, { borderLeftColor: c.petrol }]}>
              <Text style={[styles.infoLabel, { color: c.petrol }]}>Cliente</Text>
              <Text style={styles.infoName}>{clientName}</Text>
              {clientAddr ? <Text style={styles.infoText}>{clientAddr}</Text> : null}
              {clientFiscalLines(draft.client).map((line) => (
                <Text key={line} style={styles.infoText}>{line}</Text>
              ))}
            </View>
          </View>

          {/* ── PRODOTTI E SERVIZI ─────────────────────────── */}
          <Text style={styles.sectionHeading}>Prodotti e servizi</Text>
          <View style={styles.table}>
            <View style={styles.tHead}>
              <Text style={[styles.th, styles.cNr]}>Nr</Text>
              <Text style={[styles.th, styles.cDesc]}>Descrizione</Text>
              <Text style={[styles.th, styles.cQty]}>Q.tà</Text>
              <Text style={[styles.th, styles.cPrice]}>Prezzo</Text>
              <Text style={[styles.th, styles.cAmt]}>Importo</Text>
              <Text style={[styles.th, styles.cIva]}>IVA</Text>
            </View>
            {lines.map((li, i) => (
              <View key={`${li.description}-${i}`} style={styles.tRow}>
                <Text style={[{ fontSize: 9 }, styles.cNr]}>{i + 1}</Text>
                <Text style={[{ fontSize: 10 }, styles.cDesc]}>{li.description}</Text>
                <Text style={[{ fontSize: 9 }, styles.cQty]}>{li.quantity}</Text>
                <Text style={[{ fontSize: 9 }, styles.cPrice]}>{fmt(li.unitPrice)}</Text>
                <Text style={[boldVal, styles.cAmt]}>{fmt(getInvoiceDraftLineTotal(li))}</Text>
                <Text style={[{ fontSize: 8, color: c.mid }, styles.cIva]}>0% N2.2</Text>
              </View>
            ))}
            {hasStamp ? (
              <View style={styles.tRow}>
                <Text style={[{ fontSize: 9 }, styles.cNr]}>{lines.length + 1}</Text>
                <Text style={[{ fontSize: 9 }, styles.cDesc]}>{STAMP_DUTY_DESC}</Text>
                <Text style={[{ fontSize: 9 }, styles.cQty]}>1</Text>
                <Text style={[{ fontSize: 9 }, styles.cPrice]}>{fmt(totals.stampDuty)}</Text>
                <Text style={[boldVal, styles.cAmt]}>{fmt(totals.stampDuty)}</Text>
                <Text style={[{ fontSize: 8, color: c.mid }, styles.cIva]}>0% N2.2</Text>
              </View>
            ) : null}
          </View>

          {/* ── METODO DI PAGAMENTO ───────────────────────── */}
          <Text style={styles.sectionHeading}>Metodo di pagamento</Text>
          <View style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View style={{ width: "25%" }}>
                <Text style={microLabel}>Modalità</Text>
                <Text style={boldVal}>Bonifico</Text>
              </View>
              {issuer.bankName ? (
                <View style={{ width: "22%" }}>
                  <Text style={microLabel}>Banca</Text>
                  <Text style={boldVal}>{issuer.bankName}</Text>
                </View>
              ) : null}
              {issuer.bic ? (
                <View style={{ width: "22%" }}>
                  <Text style={microLabel}>BIC/SWIFT</Text>
                  <Text style={boldVal}>{issuer.bic}</Text>
                </View>
              ) : null}
              <View style={{ width: "25%", alignItems: "flex-end" as const }}>
                <Text style={microLabel}>Importo</Text>
                <Text style={boldVal}>{fmt(totals.totalAmount)}</Text>
              </View>
            </View>
            {issuer.iban ? (
              <View style={{ marginTop: 6 }}>
                <Text style={microLabel}>IBAN</Text>
                <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: c.ink, letterSpacing: 0.5 }}>
                  {issuer.iban}
                </Text>
              </View>
            ) : null}
          </View>

          {/* ── REGIME FISCALE ─────────────────────────────── */}
          <Text style={styles.sectionHeading}>Regime fiscale</Text>
          <View style={[styles.card, { borderLeftColor: c.petrol }]}>
            <Text style={{ ...boldVal, marginBottom: 3 }}>RF19 — Regime forfettario</Text>
            <Text style={styles.noteText}>
              Operazione senza applicazione dell'IVA ai sensi dell'art. 1 co.
              54-89 della legge n. 190/2014 così come modificato dalla legge n.
              208/2015 e dalla legge n. 145/2018
            </Text>
          </View>

          {/* ── RIEPILOGO IVA + CALCOLO ───────────────────── */}
          <Text style={styles.sectionHeading}>Riepilogo IVA e calcolo fattura</Text>
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 6 }}>
            {/* Left: IVA summary */}
            <View style={{ width: "48%", borderWidth: 0.5, borderColor: c.rule, borderRadius: 10, overflow: "hidden" }}>
              <View style={{ flexDirection: "row", backgroundColor: c.navyLight, paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: c.navy }}>
                {["IVA", "NATURA", "IMPONIBILE", "IMPOSTA"].map((h, i) => (
                  <Text key={h} style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: c.navy, letterSpacing: 1, width: i < 2 ? "18%" : "32%", textAlign: i >= 2 ? ("right" as const) : ("left" as const) }}>
                    {h}
                  </Text>
                ))}
              </View>
              <View style={{ flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8 }}>
                <Text style={{ fontSize: 9, width: "18%" }}>0%</Text>
                <Text style={{ fontSize: 9, width: "18%" }}>N2.2</Text>
                <Text style={{ fontSize: 9, width: "32%", textAlign: "right" as const }}>{fmt(totals.totalAmount)}</Text>
                <Text style={{ fontSize: 9, width: "32%", textAlign: "right" as const }}>{fmt(0)}</Text>
              </View>
            </View>
            {/* Right: Calculation */}
            <View style={{ width: "48%" }}>
              {[
                ["Importo prodotti/servizi", fmt(totals.totalAmount)],
                ["Totale non soggetto IVA (N2)", fmt(totals.totalAmount)],
                ["Totale IVA", fmt(0)],
              ].map(([label, val]) => (
                <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                  <Text style={{ fontSize: 9, color: c.mid }}>{label}</Text>
                  <Text style={{ fontSize: 9 }}>{val}</Text>
                </View>
              ))}
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                <Text style={boldVal}>Totale documento</Text>
                <Text style={boldVal}>{fmt(totals.totalAmount)}</Text>
              </View>
            </View>
          </View>

          {/* ── NETTO A PAGARE ─────────────────────────────── */}
          <View style={styles.totalHero}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: c.navy, textTransform: "uppercase" as const, letterSpacing: 2 }}>
              Netto a pagare
            </Text>
            <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", color: c.ink, letterSpacing: -0.3 }}>
              {fmt(totals.totalAmount)}
            </Text>
          </View>

          {/* ── CAUSALE ───────────────────────────────────── */}
          <View style={styles.noteCard}>
            <Text style={styles.noteTitle}>Causale</Text>
            <Text style={styles.noteText}>
              Operazione non soggetta a ritenuta alla fonte a titolo di acconto
              ai sensi dell'articolo 1, comma 67, l. n. 190 del 2014 e
              successive modificazioni
            </Text>
          </View>

          {/* ── NOTE ──────────────────────────────────────── */}
          {draft.notes ? (
            <View style={[styles.noteCard, { marginTop: 8 }]}>
              <Text style={styles.noteTitle}>Note</Text>
              <Text style={styles.noteText}>{draft.notes}</Text>
            </View>
          ) : null}

          <Text style={{ fontSize: 8, color: c.mid, marginTop: 10, textAlign: "right" as const }}>
            Rif.: {draft.source.kind} — {draft.source.label}
          </Text>
        </View>

        {/* ── Footer ──────────────────────────────────────────── */}
        <View style={styles.footer}>
          <View style={styles.footerLine} />
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
