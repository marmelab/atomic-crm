import {
  Document,
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
  vatNumber?: string;
  fiscalCode?: string;
  address?: string;
  email?: string;
};

const defaultIssuer: InvoiceDraftIssuer = {
  name: "Rosario Furnari",
};

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    lineHeight: 1.35,
    fontFamily: "Helvetica",
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
  heading: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  col: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 9,
    color: "#666666",
  },
  value: {
    fontSize: 10,
  },
  section: {
    marginTop: 14,
    gap: 6,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
    paddingBottom: 4,
    fontSize: 9,
    color: "#666666",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#efefef",
    paddingVertical: 5,
    alignItems: "center",
  },
  cDescription: {
    flex: 5,
    paddingRight: 8,
  },
  cQty: {
    flex: 1,
    textAlign: "right",
  },
  cUnit: {
    flex: 2,
    textAlign: "right",
  },
  cTotal: {
    flex: 2,
    textAlign: "right",
  },
  totals: {
    marginTop: 10,
    gap: 3,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    gap: 16,
  },
  totalLabel: {
    minWidth: 120,
    textAlign: "right",
    color: "#555555",
  },
  totalValue: {
    minWidth: 90,
    textAlign: "right",
  },
  totalHighlight: {
    fontWeight: 700,
    fontSize: 11,
  },
  note: {
    marginTop: 12,
    fontSize: 9,
    color: "#555555",
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

        <Text style={styles.heading}>Bozza fattura interna</Text>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Emittente</Text>
            <Text style={styles.value}>{issuer.name}</Text>
            {issuer.vatNumber ? (
              <Text style={styles.value}>P.IVA {issuer.vatNumber}</Text>
            ) : null}
            {issuer.fiscalCode ? (
              <Text style={styles.value}>CF {issuer.fiscalCode}</Text>
            ) : null}
            {issuer.address ? (
              <Text style={styles.value}>{issuer.address}</Text>
            ) : null}
            {issuer.email ? (
              <Text style={styles.value}>{issuer.email}</Text>
            ) : null}
          </View>

          <View style={styles.col}>
            <Text style={styles.label}>Cliente</Text>
            <Text style={styles.value}>{clientName}</Text>
            {clientAddress ? (
              <Text style={styles.value}>{clientAddress}</Text>
            ) : null}
            {clientFiscalLines(draft.client).map((line) => (
              <Text key={line} style={styles.value}>
                {line}
              </Text>
            ))}
          </View>

          <View style={styles.col}>
            <Text style={styles.label}>Dati documento</Text>
            <Text style={styles.value}>
              Data: {draft.invoiceDate ?? todayIsoDate()}
            </Text>
            <Text style={styles.value}>
              Origine: {draft.source.kind} - {draft.source.label}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.tableHeader}>
            <Text style={styles.cDescription}>Descrizione</Text>
            <Text style={styles.cQty}>Q.ta</Text>
            <Text style={styles.cUnit}>Prezzo unitario</Text>
            <Text style={styles.cTotal}>Totale</Text>
          </View>

          {lineItems.map((lineItem, index) => (
            <View
              key={`${lineItem.description}-${index}`}
              style={styles.tableRow}
            >
              <Text style={styles.cDescription}>{lineItem.description}</Text>
              <Text style={styles.cQty}>{lineItem.quantity}</Text>
              <Text style={styles.cUnit}>
                {formatAmount(lineItem.unitPrice)}
              </Text>
              <Text style={styles.cTotal}>
                {formatAmount(getInvoiceDraftLineTotal(lineItem))}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Totale imponibile</Text>
            <Text style={styles.totalValue}>
              {formatAmount(totals.taxableAmount)}
            </Text>
          </View>
          {totals.stampDuty > 0 ? (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Bollo</Text>
              <Text style={styles.totalValue}>
                {formatAmount(totals.stampDuty)}
              </Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, styles.totalHighlight]}>
              Totale documento
            </Text>
            <Text style={[styles.totalValue, styles.totalHighlight]}>
              {formatAmount(totals.totalAmount)}
            </Text>
          </View>
        </View>

        <Text style={styles.note}>
          Operazione effettuata ai sensi dell'art. 1 commi 54-89 L. 190/2014
        </Text>
        {draft.notes ? (
          <Text style={styles.note}>Note: {draft.notes}</Text>
        ) : null}
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
