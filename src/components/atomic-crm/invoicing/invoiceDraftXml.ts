import { todayISODate } from "@/lib/dateTimezone";
import type { BusinessProfile, Client } from "../types";
import {
  computeInvoiceDraftTotals,
  getInvoiceDraftLineTotal,
  normalizeInvoiceDraftLineItems,
  type InvoiceDraftInput,
} from "./invoiceDraftTypes";

// ── Constants ────────────────────────────────────────────────────────

/** Aruba PEC fiscal code — required as IdTrasmittente for XML upload. */
const ARUBA_PEC_CF = "01879020517";

const XML_NAMESPACE =
  "http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2";

const CAUSALE =
  "Operazione non soggetta a ritenuta alla fonte a titolo di acconto " +
  "ai sensi dell'articolo 1, comma 67, l. n. 190 del 2014 e successive modificazioni";

const RIFERIMENTO_NORMATIVO = "Non soggette - altri casi";

// ── Helpers ──────────────────────────────────────────────────────────

/** Escape XML special characters. */
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Format a number with exactly `decimals` decimal places (no locale). */
const fmtNum = (n: number, decimals = 2) => n.toFixed(decimals);

const tag = (name: string, value: string | number) =>
  `<${name}>${esc(String(value))}</${name}>`;

const optTag = (name: string, value: string | number | undefined | null) =>
  value != null && String(value).trim() !== "" ? tag(name, value) : "";


// ── Client billing address for XML ──────────────────────────────────

const buildClientSede = (client: Client): string => {
  const street = client.billing_address_street ?? "";
  const number = client.billing_address_number ?? "";
  const cap = client.billing_postal_code ?? "";
  const city = client.billing_city ?? "";
  const prov = client.billing_province ?? "";
  const country = client.billing_country ?? "IT";

  // Minimum required: street + CAP + city + country
  if (!street || !cap || !city) return "";

  return [
    "<Sede>",
    tag("Indirizzo", street),
    optTag("NumeroCivico", number),
    tag("CAP", cap),
    tag("Comune", city),
    optTag("Provincia", prov),
    tag("Nazione", country),
    "</Sede>",
  ].join("\n");
};

// ── XML builder ──────────────────────────────────────────────────────

export type InvoiceDraftXmlOptions = {
  draft: InvoiceDraftInput;
  issuer: BusinessProfile;
  invoiceNumber: string;
  progressivoInvio?: string;
};

export const buildInvoiceDraftXml = ({
  draft,
  issuer,
  invoiceNumber,
  progressivoInvio = "1",
}: InvoiceDraftXmlOptions): string => {
  const lines = normalizeInvoiceDraftLineItems(draft.lineItems);
  const totals = computeInvoiceDraftTotals(lines);

  const clientName =
    draft.client.billing_name ?? draft.client.name ?? "Cliente";
  const clientCodiceDestinatario = draft.client.billing_sdi_code ?? "0000000";

  // ── Header ─────────────────────────────────────────────────────

  const datiTrasmissione = [
    "<DatiTrasmissione>",
    "<IdTrasmittente>",
    tag("IdPaese", "IT"),
    tag("IdCodice", ARUBA_PEC_CF),
    "</IdTrasmittente>",
    tag("ProgressivoInvio", progressivoInvio),
    tag("FormatoTrasmissione", "FPR12"),
    tag("CodiceDestinatario", clientCodiceDestinatario),
    clientCodiceDestinatario === "0000000" && draft.client.billing_pec
      ? tag("PECDestinatario", draft.client.billing_pec)
      : "",
    "</DatiTrasmissione>",
  ].join("\n");

  const cedentePrestatore = [
    "<CedentePrestatore>",
    "<DatiAnagrafici>",
    "<IdFiscaleIVA>",
    tag("IdPaese", "IT"),
    tag("IdCodice", issuer.vatNumber),
    "</IdFiscaleIVA>",
    optTag("CodiceFiscale", issuer.fiscalCode),
    "<Anagrafica>",
    tag("Denominazione", issuer.name),
    "</Anagrafica>",
    tag("RegimeFiscale", "RF19"),
    "</DatiAnagrafici>",
    "<Sede>",
    tag("Indirizzo", issuer.addressStreet),
    optTag("NumeroCivico", issuer.addressNumber),
    tag("CAP", issuer.addressPostalCode),
    tag("Comune", issuer.addressCity),
    optTag("Provincia", issuer.addressProvince),
    tag("Nazione", issuer.addressCountry || "IT"),
    "</Sede>",
    "<Contatti>",
    optTag("Telefono", issuer.phone),
    optTag("Email", issuer.email),
    "</Contatti>",
    "</CedentePrestatore>",
  ].join("\n");

  // Client anagrafica: prefer IdFiscaleIVA if vat_number, else CodiceFiscale
  const clientAnagrafici = [
    "<DatiAnagrafici>",
    draft.client.vat_number
      ? [
          "<IdFiscaleIVA>",
          tag("IdPaese", "IT"),
          tag("IdCodice", draft.client.vat_number),
          "</IdFiscaleIVA>",
        ].join("\n")
      : "",
    optTag("CodiceFiscale", draft.client.fiscal_code),
    "<Anagrafica>",
    tag("Denominazione", clientName),
    "</Anagrafica>",
    "</DatiAnagrafici>",
  ].join("\n");

  const clientSede = buildClientSede(draft.client);

  const cessionarioCommittente = [
    "<CessionarioCommittente>",
    clientAnagrafici,
    clientSede,
    "</CessionarioCommittente>",
  ].join("\n");

  const header = [
    '<FatturaElettronicaHeader xmlns="">',
    datiTrasmissione,
    cedentePrestatore,
    cessionarioCommittente,
    "</FatturaElettronicaHeader>",
  ].join("\n");

  // ── Body ───────────────────────────────────────────────────────

  const datiGeneraliDocumento = [
    "<DatiGeneraliDocumento>",
    tag("TipoDocumento", "TD01"),
    tag("Divisa", "EUR"),
    tag("Data", draft.invoiceDate ?? todayISODate()),
    tag("Numero", invoiceNumber),
    tag("ImportoTotaleDocumento", fmtNum(totals.totalAmount)),
    tag("Causale", CAUSALE),
    "</DatiGeneraliDocumento>",
  ].join("\n");

  const dettaglioLinee = lines.map((li, i) =>
    [
      "<DettaglioLinee>",
      tag("NumeroLinea", i + 1),
      tag("Descrizione", li.description),
      tag("Quantita", fmtNum(li.quantity)),
      tag("PrezzoUnitario", fmtNum(li.unitPrice)),
      tag("PrezzoTotale", fmtNum(getInvoiceDraftLineTotal(li))),
      tag("AliquotaIVA", "0.00"),
      tag("Natura", "N2.2"),
      "</DettaglioLinee>",
    ].join("\n"),
  );

  const datiRiepilogo = [
    "<DatiRiepilogo>",
    tag("AliquotaIVA", "0.00"),
    tag("Natura", "N2.2"),
    tag("ImponibileImporto", fmtNum(totals.totalAmount)),
    tag("Imposta", "0.00"),
    tag("RiferimentoNormativo", RIFERIMENTO_NORMATIVO),
    "</DatiRiepilogo>",
  ].join("\n");

  const datiBeniServizi = [
    "<DatiBeniServizi>",
    ...dettaglioLinee,
    datiRiepilogo,
    "</DatiBeniServizi>",
  ].join("\n");

  const datiPagamento = [
    "<DatiPagamento>",
    tag("CondizioniPagamento", "TP02"),
    "<DettaglioPagamento>",
    optTag("Beneficiario", issuer.beneficiaryName),
    tag("ModalitaPagamento", "MP05"),
    tag("ImportoPagamento", fmtNum(totals.totalAmount)),
    optTag("IstitutoFinanziario", issuer.bankName),
    optTag("IBAN", issuer.iban),
    optTag("BIC", issuer.bic),
    "</DettaglioPagamento>",
    "</DatiPagamento>",
  ].join("\n");

  const body = [
    '<FatturaElettronicaBody xmlns="">',
    "<DatiGenerali>",
    datiGeneraliDocumento,
    "</DatiGenerali>",
    datiBeniServizi,
    datiPagamento,
    "</FatturaElettronicaBody>",
  ].join("\n");

  // ── Document ───────────────────────────────────────────────────

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<FatturaElettronica versione="FPR12" xmlns="${XML_NAMESPACE}">`,
    header,
    body,
    "</FatturaElettronica>",
  ].join("\n");
};

// ── Download helper ──────────────────────────────────────────────────

export const downloadInvoiceDraftXml = (
  options: InvoiceDraftXmlOptions,
): void => {
  const xml = buildInvoiceDraftXml(options);
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  // Standard naming: IT{CF}_{progressive}.xml
  const cfPart =
    options.issuer.fiscalCode || options.issuer.vatNumber || "draft";
  anchor.download = `IT${cfPart}_${String(options.draft.source.id)}.xml`;
  anchor.click();

  URL.revokeObjectURL(url);
};
