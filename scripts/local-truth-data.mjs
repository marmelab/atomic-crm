import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SOURCE_ROOT = path.resolve(process.cwd(), "Fatture");
const INTERNAL_ACCOUNTING_DIR = path.join(
  SOURCE_ROOT,
  "contabilità interna - diego caltabiano",
);

const OUR_VAT_NUMBER = "01309870861";
const OUR_FISCAL_CODE = "FRNRRD87A11G580E";
const GUSTARE_NAME = "ASSOCIAZIONE CULTURALE GUSTARE SICILIA";
const GUSTARE_FISCAL_CODE = "05416820875";
const GUSTARE_CLIENT_KEY = `fiscal:${GUSTARE_FISCAL_CODE}`;
const KM_RATE = 0.19;

const SUPPLEMENTARY_OPERATIONAL_TRUTH = new Map([
  [
    "FPR 9/25",
    {
      paymentDate: "2026-01-26",
      paymentStatus: "ricevuto",
      paymentNote:
        "Incasso confermato dall'utente il 26/01/2026.",
      services: [
        { date: "2025-10-15", location: "Mazzarino" },
        { date: "2025-10-16", location: "Riesi" },
        { date: "2025-10-20", location: "Sommatino" },
        { date: "2025-10-23", location: "Butera" },
      ],
      projectName: "Gustare Sicilia — Nisseno",
      tariff: { feeShooting: 187, feeEditing: 249 },
      kmDistance: 0,
    },
  ],
]);

// Work done but never invoiced.  The CSV source records only dates with zero
// amounts for these episodes.  Tariffs confirmed by the user (standard BTF
// rates).  These generate services, km expenses and a single pending payment.
const UNFILED_OPERATIONAL_TRUTH = [
  {
    projectName: "Bella tra i Fornelli",
    services: [
      { date: "2025-09-18", location: "Cantina Tre Santi", note: "Vendemmia" },
      { date: "2025-10-21", location: "Cantina Tre Santi", note: "Puntata finale" },
    ],
    tariff: { feeShooting: 187, feeEditing: 125 },
    kmDistance: 120,
    paymentNote:
      "Non fatturato — 2 puntate BTF Cantina Tre Santi (vendemmia + finale).",
  },
  {
    projectName: "Vale il Viaggio",
    services: [
      { date: "2026-01-29", location: "Palermo", note: "Natale Giunta" },
    ],
    // 2026 tariffs: default_fee_shooting + default_fee_editing_short
    tariff: { feeShooting: 233, feeEditing: 156 },
    // No travel: car left near home, ignore km
    kmDistance: 0,
    paymentNote:
      "Non fatturato — 1 puntata Vale il Viaggio (Natale Giunta).",
  },
  {
    projectName: "Vale il Viaggio",
    services: [
      { date: "2026-02-02", location: "Taormina", note: "Saretto Bambar" },
    ],
    tariff: { feeShooting: 233, feeEditing: 156 },
    // A/R Valguarnera Caropepe → McDonald's Acireale (Via Cefalù 30) ≈ 96 km × 2
    kmDistance: 192,
    paymentNote:
      "Non fatturato — 1 puntata Vale il Viaggio (Saretto Bambar).",
  },
  {
    projectName: "Vale il Viaggio",
    services: [
      { date: "2026-02-22", location: "Milazzo", note: "Roberto Lipari" },
    ],
    tariff: { feeShooting: 233, feeEditing: 156 },
    // A/R Valguarnera Caropepe → McDonald's Acireale (Via Cefalù 30) ≈ 96 km × 2
    kmDistance: 192,
    paymentNote:
      "Non fatturato — 1 puntata Vale il Viaggio (Roberto Lipari).",
  },
];

// Source: Aruba Fatturazione Elettronica portal, "FATTURE INVIATE".
// Screenshots captured 2026-03-02 for years 2023, 2024, 2025.
// "Doc. coll." column provides exact collection dates.
// Excluded: FPA 1/23 ("Non incassata"), FPA 1/25 + FPA 2/25 ("Stornata").
export const ARUBA_PORTAL_TRUTH = new Map([
  // ── 2023 (11 invoices, 10 incassata + 1 non incassata) ──
  ["FPR 1/23", { collectionDate: "2023-04-01" }],
  ["FPR 2/23", { collectionDate: "2023-10-25" }],
  ["FPR 3/23", { collectionDate: "2023-07-25" }],
  ["FPR 4/23", { collectionDate: "2023-08-16" }],
  ["FPR 5/23", { collectionDate: "2023-09-22" }],
  ["FPR 6/23", { collectionDate: "2023-10-31" }],
  ["FPR 7/23", { collectionDate: "2023-12-27" }],
  ["FPR 8/23", { collectionDate: "2023-12-12" }],
  ["FPR 9/23", { collectionDate: "2023-12-27" }],
  ["FPR 10/23", { collectionDate: "2024-01-30" }],
  // FPA 1/23: "Non incassata" — remains scaduto, intentionally excluded.

  // ── 2024 (7 invoices, all incassata) ──
  ["FPR 1/24", { collectionDate: "2024-01-07" }],
  ["FPR 2/24", { collectionDate: "2024-02-15" }],
  ["FPR 3/24", { collectionDate: "2024-03-28" }],
  ["FPR 4/24", { collectionDate: "2024-06-03" }],
  ["FPR 5/24", { collectionDate: "2024-09-13" }],
  ["FPR 6/24", { collectionDate: "2024-10-01" }],
  ["FPR 7/24", { collectionDate: "2024-12-27" }],

  // ── 2025 (13 invoices, 11 incassata + 2 stornata) ──
  ["FPR 1/25", { collectionDate: "2025-03-03" }],
  ["FPR 2/25", { collectionDate: "2025-05-14" }],
  ["FPA 3/25", { collectionDate: "2025-05-20" }],
  ["FPR 3/25", { collectionDate: "2025-07-08" }],
  ["FPA 4/25", { collectionDate: "2025-07-23" }],
  ["FPR 4/25", { collectionDate: "2025-10-14" }],
  ["FPR 5/25", { collectionDate: "2025-10-31" }],
  ["FPR 6/25", { collectionDate: "2025-11-11" }],
  ["FPR 7/25", { collectionDate: "2025-12-23" }],
  ["FPR 8/25", { collectionDate: "2025-12-27" }],
  ["FPR 9/25", { collectionDate: "2026-01-26" }],
  // FPA 1/25, FPA 2/25: "Stornata" — handled by credit note logic.
]);

// Source: Aruba Fatturazione Elettronica portal, "Report Clienti" export.
// File: Fatture/ReportClienti.xls (PDF companion: ReportClienti.pdf).
// Deduplicated: Comune di Aidone (8 rows → 1 most complete).
// Excluded: Edmondo Tamajo, Gioielleria Giangreco (per user instruction).
const ARUBA_CLIENT_REGISTRY = [
  {
    name: "AQUACHETA S.R.L.",
    vatNumber: "01577390881",
    fiscalCode: "01577390881",
    email: "INFO@AQUACHETA.COM",
    billingPec: "INFO@AQUACHETA.COM",
    billingSdiCode: "0000000",
    billingAddressStreet: "VIALE DEI PLATANI",
    billingAddressNumber: "37",
    billingPostalCode: "97100",
    billingCity: "RAGUSA",
    billingProvince: "RG",
    billingCountry: "IT",
  },
  {
    name: "ARCHEOCLUB AIDONE MORGANTINA",
    fiscalCode: "91014460868",
    billingSdiCode: "0000000",
    billingAddressStreet: "Piazza Dante",
    billingPostalCode: "94010",
    billingCity: "Aidone",
    billingProvince: "EN",
    billingCountry: "IT",
  },
  {
    name: "ASSOCIAZIONE CULTURALE GUSTARE SICILIA",
    fiscalCode: "05416820875",
    billingPec: "gustsresicilia@pec.it",
    billingSdiCode: "KRRH6B9",
    billingAddressStreet: "Via Marino",
    billingPostalCode: "95031",
    billingCity: "Adrano",
    billingProvince: "CT",
    billingCountry: "IT",
  },
  {
    name: "Associazione EUROFORM",
    vatNumber: "02060570849",
    billingSdiCode: "M5UXCR1",
    billingAddressStreet: "PIAZZA UMBERTO I",
    billingAddressNumber: "23",
    billingPostalCode: "92021",
    billingCity: "Aragona",
    billingProvince: "AG",
    billingCountry: "IT",
  },
  {
    name: "ASSOCIAZIONE LA TERRA ELETTRICA",
    fiscalCode: "91064300865",
    billingSdiCode: "0000000",
    billingAddressStreet: "VIA GIOSUE' CARDUCCI",
    billingAddressNumber: "12",
    billingPostalCode: "94015",
    billingCity: "PIAZZA ARMERINA",
    billingProvince: "EN",
    billingCountry: "IT",
  },
  {
    name: "ASSOCIAZIONE VOLONTARIATO AMICI DELLO SPORT AICS",
    fiscalCode: "93076910848",
    billingSdiCode: "0000000",
    billingAddressStreet: "VIA BORSELLINO",
    billingAddressNumber: "42",
    billingPostalCode: "92021",
    billingCity: "ARAGONA",
    billingProvince: "AG",
    billingCountry: "IT",
  },
  {
    name: "B&B LA QUERCIA E L'ASINO DI SALVATORE ZUCCARELLO",
    vatNumber: "01233170867",
    fiscalCode: "ZCCSVT82A01G580X",
    billingSdiCode: "0000000",
    billingAddressStreet: "VIA MARTIN LUTHER KING",
    billingAddressNumber: "4",
    billingPostalCode: "94015",
    billingCity: "PIAZZA ARMERINA",
    billingProvince: "EN",
    billingCountry: "IT",
  },
  {
    // Most complete row of 8 duplicates (with payment info).
    name: "Comune di Aidone - Politiche Sociali Demografici Cultura Biblioteca",
    fiscalCode: "80001220864",
    billingPec: "protocollo@pec.aidoneonline.it",
    billingSdiCode: "20B66B",
    billingAddressStreet: "Piazza umberto I",
    billingPostalCode: "94010",
    billingCity: "Aidone",
    billingProvince: "EN",
    billingCountry: "IT",
    clientType: "azienda_locale",
  },
  {
    name: "CAMERA A SUD EVENTI",
    vatNumber: "01317860862",
    fiscalCode: "91067240860",
    billingSdiCode: "N92GLON",
    billingAddressStreet: "VIA NICOTERA",
    billingAddressNumber: "33",
    billingPostalCode: "94019",
    billingCity: "VALGUARNERA CAROPEPE",
    billingProvince: "EN",
    billingCountry: "IT",
  },
  {
    name: "LA MARTINA GIOVANNI",
    vatNumber: "01312710864",
    fiscalCode: "LMRGNN79C26C351V",
    billingSdiCode: "0000000",
    billingAddressStreet: "CONTRADA DAINAMARE",
    billingPostalCode: "94019",
    billingCity: "VALGUARNERA CAROPEPE",
    billingProvince: "EN",
    billingCountry: "IT",
  },
  {
    name: "LAURUS S.R.L.",
    vatNumber: "04126560871",
    email: "rosariodavide.furnari@gmail.com",
    billingSdiCode: "M5UXCR1",
    billingAddressStreet: "VIA ROSARIO LIVATINO",
    billingAddressNumber: "1115/D",
    billingPostalCode: "97016",
    billingCity: "Pozzallo",
    billingProvince: "RG",
    billingCountry: "IT",
  },
  {
    name: "MAXI ITALIAN WAY SRL O IN FORMA ABBREVIATA M.I.W. SRL",
    vatNumber: "01804730768",
    fiscalCode: "01804730768",
    billingSdiCode: "BA6ET11",
    billingAddressStreet: "VIA SAN GEROLAMO EMILIANI",
    billingAddressNumber: "12",
    billingPostalCode: "20135",
    billingCity: "MILANO",
    billingProvince: "MI",
    billingCountry: "IT",
  },
  {
    name: "MIREDI TOMMASO",
    vatNumber: "05633790968",
    fiscalCode: "MRDTMS76B12F205T",
    email: "tommaso.miredi@gmail.com",
    billingSdiCode: "KRRH6B9",
    billingAddressStreet: "VIA VAL DI SOLE",
    billingAddressNumber: "22",
    billingPostalCode: "20141",
    billingCity: "MILANO",
    billingProvince: "MI",
    billingCountry: "IT",
  },
  {
    name: "TECNOSYS ITALIA S.R.L.",
    vatNumber: "01209050861",
    fiscalCode: "01209050861",
    email: "sonia.palma@tecnosysitalia.eu",
    billingPec: "TECNOSYSITALIASRL@LEGALMAIL.IT",
    billingSdiCode: "KRRH6B9",
    billingAddressStreet: "CONTRADA GENTILOMO",
    billingPostalCode: "94100",
    billingCity: "ENNA",
    billingProvince: "EN",
    billingCountry: "IT",
  },
];

const MONTHS = {
  gen: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  mag: 4,
  giu: 5,
  lug: 6,
  ago: 7,
  set: 8,
  sett: 8,
  ott: 9,
  nov: 10,
  dic: 11,
};

function normalizeSpaces(value) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function normalizeCase(value) {
  return normalizeSpaces(value)
    .replace(/[’']/g, "'")
    .replace(/\s+-\s+/g, " - ");
}

function toIsoDate(value) {
  return value.toISOString().slice(0, 10);
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function parseItalianDecimal(value) {
  const normalized = normalizeSpaces(String(value ?? ""))
    .replace(/\./g, "")
    .replace(",", ".");

  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCompactDecimal(value) {
  const normalized = normalizeSpaces(String(value ?? ""));
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateFromItalianLabel(value) {
  const normalized = normalizeCase(value).toLowerCase();
  if (!normalized) return null;

  const slashMatch = normalized.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const spacedMatch = normalized.match(/(\d{1,2})\s+([a-zà]+)\s+(\d{2,4})/);
  if (!spacedMatch) return null;

  const [, day, monthToken, yearToken] = spacedMatch;
  const month = MONTHS[monthToken];
  if (month === undefined) return null;

  const fullYear =
    yearToken.length === 2 ? Number(`20${yearToken}`) : Number(yearToken);
  const date = new Date(Date.UTC(fullYear, month, Number(day)));
  return Number.isNaN(date.getTime()) ? null : toIsoDate(date);
}

function xmlTagValue(xml, tag) {
  const match = xml.match(
    new RegExp(
      `<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`,
      "i",
    ),
  );
  return normalizeSpaces(
    match?.[1]
      ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'") ?? "",
  );
}

function xmlTagValues(xml, tag) {
  return [
    ...xml.matchAll(
      new RegExp(
        `<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`,
        "gi",
      ),
    ),
  ].map((match) =>
    normalizeSpaces(
      match[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'"),
    ),
  );
}

function xmlBlock(xml, tag, index = 0) {
  const matches = [
    ...xml.matchAll(
      new RegExp(
        `<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`,
        "gi",
      ),
    ),
  ];
  return matches[index]?.[1] ?? "";
}

function xmlBlocks(xml, tag) {
  return [
    ...xml.matchAll(
      new RegExp(
        `<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`,
        "gi",
      ),
    ),
  ].map((match) => match[1] ?? "");
}

function normalizeFiscalIdentifier(value) {
  const cleaned = normalizeSpaces(value).replace(/\s+/g, "");
  return cleaned ? cleaned.toUpperCase() : null;
}

function makeClientKey({ vatNumber, fiscalCode, name }) {
  if (vatNumber) return `vat:${vatNumber}`;
  if (fiscalCode) return `fiscal:${fiscalCode}`;
  return `name:${normalizeCase(name).toLowerCase()}`;
}

function makeSourceNote(parts) {
  return parts.filter(Boolean).join(" | ");
}

function inferClientType(name) {
  if (name === GUSTARE_NAME) return "produzione_tv";
  return "azienda_locale";
}

function inferMethod(xml) {
  const paymentCode = xmlTagValue(xml, "ModalitaPagamento");
  if (paymentCode === "MP05") return "bonifico";
  return "altro";
}

function mapFiscalDocumentType(documentCode, direction) {
  const normalized = normalizeCase(documentCode).toUpperCase();

  if (normalized === "TD04") {
    return direction === "incoming"
      ? "supplier_credit_note"
      : "customer_credit_note";
  }

  return direction === "incoming" ? "supplier_invoice" : "customer_invoice";
}

function extractParty(block) {
  const vatBlock = xmlBlock(block, "IdFiscaleIVA");
  const vatNumber = normalizeFiscalIdentifier(
    xmlTagValue(vatBlock, "IdCodice"),
  );
  const fiscalCode = normalizeFiscalIdentifier(
    xmlTagValue(block, "CodiceFiscale"),
  );
  const denomination = xmlTagValue(block, "Denominazione");
  const firstName = xmlTagValue(block, "Nome");
  const lastName = xmlTagValue(block, "Cognome");
  const name = denomination || normalizeSpaces(`${firstName} ${lastName}`);

  return {
    name,
    vatNumber,
    fiscalCode,
    email: normalizeSpaces(xmlTagValue(block, "Email")) || null,
    phone: normalizeSpaces(xmlTagValue(block, "Telefono")) || null,
    addressStreet: normalizeSpaces(xmlTagValue(block, "Indirizzo")) || null,
    addressNumber: normalizeSpaces(xmlTagValue(block, "NumeroCivico")) || null,
    postalCode: normalizeSpaces(xmlTagValue(block, "CAP")) || null,
    city: normalizeSpaces(xmlTagValue(block, "Comune")) || null,
    province:
      normalizeFiscalIdentifier(xmlTagValue(block, "Provincia")) || null,
    country: normalizeSpaces(xmlTagValue(block, "Nazione")) || null,
    pec:
      normalizeSpaces(xmlTagValue(block, "PECDestinatario"))?.toLowerCase() ||
      null,
  };
}

function parseInvoiceXml(filePath) {
  const xml = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const isIncoming = filePath.includes(
    `${path.sep}fatture_ricevute${path.sep}`,
  );
  const headerBlock = xmlBlock(xml, "FatturaElettronicaHeader");
  const bodyBlock = xmlBlock(xml, "FatturaElettronicaBody");
  const seller = extractParty(xmlBlock(headerBlock, "CedentePrestatore"));
  const buyer = extractParty(xmlBlock(headerBlock, "CessionarioCommittente"));
  const transmissionBlock = xmlBlock(headerBlock, "DatiTrasmissione");
  const documentBlock = xmlBlock(bodyBlock, "DatiGeneraliDocumento");
  const detailBlock = xmlBlock(bodyBlock, "DettaglioPagamento");

  const xmlDocumentCode = xmlTagValue(documentBlock, "TipoDocumento");
  const linkedDocumentBlock = xmlBlock(bodyBlock, "DatiFattureCollegate");
  const summaryBlocks = xmlBlocks(bodyBlock, "DatiRiepilogo");
  const number = xmlTagValue(documentBlock, "Numero");
  const issueDate = xmlTagValue(documentBlock, "Data");
  const dueDate = xmlTagValue(detailBlock, "DataScadenzaPagamento") || null;
  const documentTotal =
    parseCompactDecimal(xmlTagValue(documentBlock, "ImportoTotaleDocumento")) ??
    0;
  const taxableAmount = roundCurrency(
    summaryBlocks.reduce(
      (sum, block) =>
        sum +
        (parseCompactDecimal(xmlTagValue(block, "ImponibileImporto")) ?? 0),
      0,
    ),
  );
  const taxAmount = roundCurrency(
    summaryBlocks.reduce(
      (sum, block) =>
        sum + (parseCompactDecimal(xmlTagValue(block, "Imposta")) ?? 0),
      0,
    ),
  );
  const stampAmount =
    parseCompactDecimal(xmlTagValue(documentBlock, "ImportoBollo")) ?? 0;
  const paymentAmount =
    parseCompactDecimal(xmlTagValue(detailBlock, "ImportoPagamento")) ??
    documentTotal;
  const receiverSdi =
    normalizeFiscalIdentifier(
      xmlTagValue(transmissionBlock, "CodiceDestinatario"),
    ) || null;

  const counterparty = isIncoming ? seller : buyer;
  const ourParty = isIncoming ? buyer : seller;

  return {
    filePath,
    direction: isIncoming ? "incoming" : "outgoing",
    xmlDocumentCode,
    fiscalDocumentType: mapFiscalDocumentType(
      xmlDocumentCode,
      isIncoming ? "incoming" : "outgoing",
    ),
    relatedDocumentNumber:
      xmlTagValue(linkedDocumentBlock, "IdDocumento") || null,
    number,
    issueDate,
    dueDate,
    total: documentTotal,
    taxableAmount,
    taxAmount,
    stampAmount,
    payableAmount: paymentAmount,
    method: inferMethod(xml),
    descriptions: xmlTagValues(bodyBlock, "Descrizione"),
    counterparty,
    ourParty,
    receiverSdi,
  };
}

function listXmlFiles() {
  return fs
    .readdirSync(SOURCE_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .flatMap((yearDir) => {
      const yearPath = path.join(SOURCE_ROOT, yearDir.name);
      return fs
        .readdirSync(yearPath, { withFileTypes: true })
        .flatMap((entry) => {
          if (entry.isFile() && entry.name.endsWith(".xml")) {
            return [path.join(yearPath, entry.name)];
          }

          if (entry.isDirectory() && entry.name === "fatture_ricevute") {
            return fs
              .readdirSync(path.join(yearPath, entry.name))
              .filter((name) => name.endsWith(".xml"))
              .map((name) => path.join(yearPath, entry.name, name));
          }

          return [];
        });
    })
    .sort();
}

function csvRows(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.split(";").map((part) => normalizeSpaces(part)));
}

function isServicePlaceholder(row) {
  const [date, btf, gs, spot, shooting, editing, km] = row;
  return (
    Boolean(parseDateFromItalianLabel(date)) &&
    Boolean(btf || gs || spot) &&
    !parseItalianDecimal(shooting) &&
    !parseItalianDecimal(editing) &&
    !parseItalianDecimal(km)
  );
}

function isSummaryLikeLabel(value) {
  const normalized = normalizeCase(value).toLowerCase();
  return (
    normalized.startsWith("tot.") ||
    normalized.startsWith("acconto") ||
    normalized.startsWith("da saldare") ||
    normalized.startsWith("km") ||
    normalized.startsWith("servizi") ||
    normalized.startsWith("hardisk") ||
    normalized.startsWith("iphone") ||
    normalized.startsWith("rif.") ||
    normalized.startsWith("nr.") ||
    normalized.startsWith("fatt.")
  );
}

function mapSpotProject(name) {
  const normalized = normalizeCase(name).toLowerCase();
  if (normalized.includes("colate verdi")) return "Spot Colate Verdi Evo Etna";
  if (normalized.includes("rosemary")) return "Spot Rosemary's Pub";
  if (normalized.includes("panino")) return "Spot Panino Mania";
  if (normalized.includes("hclinic")) return "Spot HCLINIC";
  if (normalized.includes("spritz")) return "Spot Spritz & Co";
  if (normalized.includes("castellaccio")) return "Spot Il Castellaccio";
  return `Spot ${normalizeCase(name)}`;
}

function resolveProjectFromRow(row) {
  const [, btf, gs, spot] = row;

  if ([btf, gs, spot].some((value) => value && isSummaryLikeLabel(value))) {
    return null;
  }

  if (btf) {
    return {
      projectName: "Bella tra i Fornelli",
      location: btf,
    };
  }

  if (gs) {
    const isBorghi = /^\d+\s*-\s*/.test(gs);
    return {
      projectName: isBorghi
        ? "Gustare Sicilia — Borghi Marinari"
        : "Gustare Sicilia",
      location: gs,
    };
  }

  if (spot) {
    return {
      projectName: mapSpotProject(spot),
      location: spot,
    };
  }

  return null;
}

function parseServiceEntry(row, context) {
  if (isServicePlaceholder(row)) return null;

  const resolvedProject = resolveProjectFromRow(row);
  if (!resolvedProject) return null;

  const [dateRaw, , , , shootingRaw, editingRaw, kmRaw, noteRaw] = row;
  const shooting = parseItalianDecimal(shootingRaw) ?? 0;
  const editing = parseItalianDecimal(editingRaw) ?? 0;
  const km = parseItalianDecimal(kmRaw) ?? 0;

  if (!shooting && !editing && !km) {
    return null;
  }

  let serviceDate = parseDateFromItalianLabel(dateRaw);
  const notes = [];

  if (!serviceDate) {
    serviceDate = context.lastDatedServiceDate;
    notes.push(
      "Data assente nella fonte; ancorata all'ultimo servizio datato precedente.",
    );
  } else {
    context.lastDatedServiceDate = serviceDate;
  }

  const cleanedNote = normalizeCase(noteRaw);
  if (cleanedNote) {
    notes.push(cleanedNote);
  }

  if (!serviceDate) {
    throw new Error(
      `Impossibile derivare una data servizio per la riga ${JSON.stringify(row)}.`,
    );
  }

  return {
    kind: "service",
    projectName: resolvedProject.projectName,
    serviceDate,
    serviceType:
      shooting > 0 && editing > 0
        ? "riprese_montaggio"
        : shooting > 0
          ? "riprese"
          : "montaggio",
    feeShooting: shooting,
    feeEditing: editing,
    feeOther: 0,
    kmDistance: km,
    location: normalizeCase(resolvedProject.location) || null,
    notes,
  };
}

function parseManualEntry(row, context) {
  const [dateRaw, btf, gs, spot, col4, col5, col6, noteRaw] = row;
  if (btf || gs || spot) return null;

  const note = normalizeCase(noteRaw);
  if (!note) return null;

  const possibleAmount =
    parseItalianDecimal(col4) ??
    parseItalianDecimal(col5) ??
    parseItalianDecimal(col6);

  if (possibleAmount === null) return null;

  const entryDate =
    parseDateFromItalianLabel(dateRaw) ?? context.lastDatedServiceDate ?? null;

  if (/bonus montaggio/i.test(note)) {
    return {
      kind: "ignored_adjustment",
      amount: possibleAmount,
      note,
      entryDate,
    };
  }

  if (/iphone/i.test(note)) {
    return {
      kind: "manual_expense",
      amount: possibleAmount,
      description: note,
      entryDate,
      projectName: null,
    };
  }

  if (/hard\s*disk|hardisk/i.test(note)) {
    return {
      kind: "manual_expense",
      amount: possibleAmount,
      description: note,
      entryDate,
      projectName: null,
    };
  }

  return null;
}

function parsePaymentEvent(row) {
  const label = normalizeCase(row[3]);
  const amount = parseItalianDecimal(row[4]);

  if (!label || amount === null) return null;
  if (!/^Acconto/i.test(label)) return null;

  const date = parseDateFromItalianLabel(label);
  if (!date) return null;

  return { date, amount };
}

function parseSummaryMarker(rawMarker, outgoingIndex) {
  const marker = normalizeCase(rawMarker);
  if (!marker) return null;

  const refMatch = marker.match(
    /(?:rif\.\s*fattura\s*n\.|nr\.)\s*(FPR\s*\d+\/\d+)\s+del\s+(\d{1,2}\/\d{2}\/\d{4})/i,
  );

  if (refMatch) {
    return {
      invoiceRef: normalizeSpaces(refMatch[1]).replace(/\s+/g, " "),
      invoiceDate: parseDateFromItalianLabel(refMatch[2]),
      markerLabel: marker,
    };
  }

  if (
    /fatt\.?\s*borghi marinari|fattura dedicata al progetto borghi marinari/i.test(
      marker,
    )
  ) {
    const resolved = outgoingIndex.byRef.get("FPR 6/25");
    return {
      invoiceRef: resolved?.number ?? "FPR 6/25",
      invoiceDate: resolved?.issueDate ?? "2025-11-04",
      markerLabel: marker,
    };
  }

  return null;
}

function findSummaryMarker(row, outgoingIndex) {
  for (const cell of row) {
    const marker = parseSummaryMarker(cell, outgoingIndex);
    if (marker) {
      return marker;
    }
  }

  return null;
}

function parseAccountingSource(filePath, outgoingIndex) {
  const rows = csvRows(filePath);
  const blocks = [];
  const paymentEvents = [];
  const invoiceSummaries = new Map();
  const pendingEntries = [];
  const context = {
    lastDatedServiceDate: null,
  };

  function finalizePendingBlock(marker) {
    if (!marker || pendingEntries.length === 0) {
      pendingEntries.length = 0;
      return;
    }

    blocks.push({
      sourceFile: path.basename(filePath),
      invoiceRef: marker.invoiceRef,
      invoiceDate: marker.invoiceDate,
      markerLabel: marker.markerLabel,
      entries: [...pendingEntries],
    });

    pendingEntries.length = 0;
  }

  let currentSummaryMarker = null;

  for (const row of rows) {
    if (row.every((cell) => !cell)) {
      currentSummaryMarker = currentSummaryMarker;
      continue;
    }

    const summaryMarker = findSummaryMarker(row, outgoingIndex);
    if (summaryMarker) {
      finalizePendingBlock(summaryMarker);
      currentSummaryMarker = summaryMarker.invoiceRef;

      if (!invoiceSummaries.has(summaryMarker.invoiceRef)) {
        invoiceSummaries.set(summaryMarker.invoiceRef, {
          invoiceRef: summaryMarker.invoiceRef,
          invoiceDate: summaryMarker.invoiceDate,
          sourceFile: path.basename(filePath),
          markerLabel: summaryMarker.markerLabel,
        });
      }
      continue;
    }

    const paymentEvent = parsePaymentEvent(row);
    if (paymentEvent) {
      paymentEvents.push(paymentEvent);
      continue;
    }

    if (currentSummaryMarker) {
      const summary = invoiceSummaries.get(currentSummaryMarker);
      const label = normalizeCase(row[0]).toLowerCase();
      const value = parseItalianDecimal(row[1]);
      if (summary && label && value !== null) {
        if (label === "km x € 0.19") summary.kmAmount = value;
        if (label === "servizi €") summary.servicesAmount = value;
        if (label === "tot €") {
          summary.totalAmount = value;
          currentSummaryMarker = null;
        }
        if (label === "hardisk €") summary.hardDiskAmount = value;
        if (label === "iphone €") summary.ignoredAdjustmentAmount = value;
      }
    }

    const serviceEntry = parseServiceEntry(row, context);
    if (serviceEntry) {
      pendingEntries.push(serviceEntry);
      continue;
    }

    const manualEntry = parseManualEntry(row, context);
    if (manualEntry) {
      pendingEntries.push(manualEntry);
    }
  }

  return {
    blocks,
    paymentEvents,
    invoiceSummaries,
  };
}

function inferProjectMeta(projectName) {
  if (projectName === "Gustare Sicilia") {
    return {
      category: "produzione_tv",
      tvShow: "gustare_sicilia",
      status: "in_corso",
    };
  }

  if (projectName === "Gustare Sicilia — Borghi Marinari") {
    return {
      category: "produzione_tv",
      tvShow: "gustare_sicilia",
      status: "completato",
    };
  }

  if (projectName === "Gustare Sicilia — Nisseno") {
    return {
      category: "produzione_tv",
      tvShow: "gustare_sicilia",
      status: "completato",
    };
  }

  if (projectName === "Bella tra i Fornelli") {
    return {
      category: "produzione_tv",
      tvShow: "bella_tra_i_fornelli",
      status: "completato",
    };
  }

  if (projectName === "Vale il Viaggio") {
    return {
      category: "produzione_tv",
      tvShow: "vale_il_viaggio",
      status: "in_corso",
    };
  }

  return {
    category: "spot",
    tvShow: null,
    status: "completato",
  };
}

function registerProject(projectMap, projectName, startDate) {
  if (!projectName) return;

  if (!projectMap.has(projectName)) {
    projectMap.set(projectName, {
      name: projectName,
      clientKey: GUSTARE_CLIENT_KEY,
      startDate,
      ...inferProjectMeta(projectName),
    });
    return;
  }

  const project = projectMap.get(projectName);
  if (startDate && (!project.startDate || startDate < project.startDate)) {
    project.startDate = startDate;
  }
}

function mergeAmountByProject(targetMap, projectName, amount) {
  if (!projectName || Math.abs(amount) < 0.01) return;

  const current = targetMap.get(projectName) ?? 0;
  targetMap.set(projectName, roundCurrency(current + amount));
}

function mergeProjectTotals(targetMap, sourceMap) {
  for (const [projectName, amount] of sourceMap.entries()) {
    mergeAmountByProject(targetMap, projectName, amount);
  }
}

function sumAmounts(values) {
  return roundCurrency(values.reduce((sum, value) => sum + value, 0));
}

function normalizeDescriptionBlob(descriptions) {
  return normalizeCase(descriptions.filter(Boolean).join(" | ")).toLowerCase();
}

function inferProjectFromOutgoingInvoice(invoice) {
  const descriptionBlob = normalizeDescriptionBlob(invoice.descriptions);
  if (!descriptionBlob) return null;

  if (
    /riesi|mazzarino|butera|sommatino|nisseno/.test(descriptionBlob)
  ) {
    return "Gustare Sicilia — Nisseno";
  }

  if (
    /borghi marinari|acitrezza|brucoli|castellammare|marzamemi|capo d.?orlando|selinunte|isola delle femmine|salina|custonaci|sferracavallo|santa flavia|lipari|favignana|sciacca/.test(
      descriptionBlob,
    )
  ) {
    return "Gustare Sicilia — Borghi Marinari";
  }

  if (/bella tra i fornelli/.test(descriptionBlob)) {
    return "Bella tra i Fornelli";
  }

  if (/carratois|camping/.test(descriptionBlob)) {
    return "Spot Camping Carratois";
  }

  if (/colate verdi/.test(descriptionBlob)) return "Spot Colate Verdi Evo Etna";
  if (/rosemary/.test(descriptionBlob)) return "Spot Rosemary's Pub";
  if (/panino/.test(descriptionBlob)) return "Spot Panino Mania";
  if (/hclinic/.test(descriptionBlob)) return "Spot HCLINIC";
  if (/spritz/.test(descriptionBlob)) return "Spot Spritz & Co";
  if (/castellaccio/.test(descriptionBlob)) return "Spot Il Castellaccio";

  if (
    /gustare sicilia|spot televisivo|riprese video|ripresa e montaggio video|cartolina piazza armerina|vino/.test(
      descriptionBlob,
    )
  ) {
    return "Gustare Sicilia";
  }

  return null;
}

function resolveManualExpenseProject(entry, projectNames) {
  return entry.projectName ?? null;
}

function resolveAdjustmentProject(entry, projectNames) {
  if (
    /bonus montaggio/i.test(entry.note || "") &&
    projectNames.has("Gustare Sicilia")
  ) {
    return "Gustare Sicilia";
  }

  if (projectNames.size === 1) {
    return [...projectNames][0];
  }

  return null;
}

function distributeResidualAcrossProjects(groupedByProject, residual) {
  const projectEntries = [...groupedByProject.entries()].filter(
    ([, amount]) => Math.abs(amount) >= 0.01,
  );

  if (projectEntries.length === 0 || Math.abs(residual) < 0.01) {
    return;
  }

  const totalAllocated = projectEntries.reduce(
    (sum, [, amount]) => sum + amount,
    0,
  );

  if (totalAllocated <= 0.009) {
    mergeAmountByProject(groupedByProject, projectEntries[0][0], residual);
    return;
  }

  let distributed = 0;
  projectEntries.forEach(([projectName, amount], index) => {
    const share =
      index === projectEntries.length - 1
        ? roundCurrency(residual - distributed)
        : roundCurrency((residual * amount) / totalAllocated);

    mergeAmountByProject(groupedByProject, projectName, share);
    distributed = roundCurrency(distributed + share);
  });
}

function resolveSingleProjectBlockMatch({
  block,
  projectNames,
  groupedByProject,
  currentKmByProject,
  carryoverKm,
  manualEntries,
  adjustmentEntries,
  outgoingIndex,
}) {
  if (projectNames.size !== 1) return null;

  const [projectName] = [...projectNames];
  const xmlInvoice = outgoingIndex.byRef.get(block.invoiceRef);
  if (
    block.invoiceDate &&
    xmlInvoice?.issueDate &&
    block.invoiceDate !== xmlInvoice.issueDate
  ) {
    return null;
  }

  const serviceFeesTotal = sumAmounts([...groupedByProject.values()]);
  const kmTotal =
    (block.summary?.kmAmount ?? 0) > 0
      ? sumAmounts([
          ...carryoverKm.values(),
          ...currentKmByProject.values(),
        ])
      : 0;
  const manualTotal = sumAmounts(
    manualEntries.map((entry) => roundCurrency(entry.amount ?? 0)),
  );
  const adjustmentTotal = sumAmounts(
    adjustmentEntries.map((entry) => roundCurrency(entry.amount ?? 0)),
  );
  const reconciledTotal = roundCurrency(
    serviceFeesTotal + kmTotal + manualTotal + adjustmentTotal,
  );

  return reconciledTotal === roundCurrency(block.totalAmount) ? projectName : null;
}

function buildOutgoingIndex(invoices) {
  const byRef = new Map();
  for (const invoice of invoices.filter(
    (row) => row.direction === "outgoing",
  )) {
    byRef.set(invoice.number, invoice);
  }
  return { byRef };
}

function classifyOpenStatus(invoice) {
  if (!invoice.dueDate) return "in_attesa";
  return invoice.dueDate < toIsoDate(new Date()) ? "scaduto" : "in_attesa";
}

function resolveOperationalPaymentStatus(invoice) {
  const supplementary = SUPPLEMENTARY_OPERATIONAL_TRUTH.get(invoice.number);
  if (supplementary?.paymentStatus) {
    return {
      status: supplementary.paymentStatus,
      note: supplementary.paymentNote ?? null,
    };
  }

  const portalTruth = ARUBA_PORTAL_TRUTH.get(invoice.number);
  if (portalTruth) {
    return {
      status: "ricevuto",
      paymentDate: portalTruth.collectionDate,
      note: `Incassata il ${portalTruth.collectionDate} — fonte: portale Aruba Fatturazione Elettronica.`,
    };
  }

  return {
    status: classifyOpenStatus(invoice),
    note: null,
  };
}

function deriveInternalSettlements(
  blocks,
  paymentEvents,
  invoiceSummaries,
  outgoingIndex,
) {
  const sortedEvents = [...paymentEvents].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const orderedBlocks = blocks.map((block) => {
    const summary = invoiceSummaries.get(block.invoiceRef);
    const xmlInvoice = outgoingIndex.byRef.get(block.invoiceRef);
    const totalAmount = roundCurrency(
      summary?.totalAmount ??
        block.entries.reduce((sum, entry) => {
          if (entry.kind === "service") {
            return (
              sum +
              entry.feeShooting +
              entry.feeEditing +
              entry.feeOther +
              roundCurrency(entry.kmDistance * KM_RATE)
            );
          }

          if (entry.kind === "manual_expense") {
            return sum + entry.amount;
          }

          return sum;
        }, 0),
    );

    return {
      ...block,
      invoiceDate: block.invoiceDate ?? xmlInvoice?.issueDate ?? null,
      dueDate: xmlInvoice?.dueDate ?? block.invoiceDate ?? null,
      totalAmount,
      summary,
      consumedAmount: 0,
      settledAt: null,
    };
  });

  let blockIndex = 0;

  for (const event of sortedEvents) {
    let remaining = event.amount;

    while (remaining > 0.0001 && blockIndex < orderedBlocks.length) {
      const block = orderedBlocks[blockIndex];
      const residual = roundCurrency(block.totalAmount - block.consumedAmount);
      const applied = Math.min(residual, remaining);

      block.consumedAmount = roundCurrency(block.consumedAmount + applied);
      remaining = roundCurrency(remaining - applied);

      if (roundCurrency(block.totalAmount - block.consumedAmount) <= 0.0001) {
        block.settledAt = event.date;
        blockIndex += 1;
      }
    }
  }

  return orderedBlocks.map((block) => ({
    ...block,
    status:
      roundCurrency(block.totalAmount - block.consumedAmount) <= 0.0001
        ? "ricevuto"
        : block.dueDate && block.dueDate < toIsoDate(new Date())
          ? "scaduto"
          : "in_attesa",
  }));
}

function deriveInternalCashMovements(blocks, paymentEvents) {
  const sortedEvents = [...paymentEvents].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const progress = blocks.map((block) => ({
    invoiceRef: block.invoiceRef,
    totalAmount: block.totalAmount,
    consumedAmount: 0,
  }));

  let blockIndex = 0;
  const cashMovements = [];
  const documentCashAllocations = [];

  sortedEvents.forEach((event, index) => {
    const movementKey = `cash:inbound:${event.date}:${event.amount}:${index}`;
    let remaining = event.amount;

    cashMovements.push({
      key: movementKey,
      clientKey: GUSTARE_CLIENT_KEY,
      projectName: null,
      direction: "inbound",
      movement_date: event.date,
      amount: roundCurrency(event.amount),
      method: "bonifico",
      reference: `Contabilita interna Diego ${event.date}`,
      source_path: path.join(
        "Fatture",
        "contabilità interna - diego caltabiano",
      ),
      notes:
        "Movimento di cassa ricostruito dalla contabilità interna Diego/Gustare.",
    });

    while (remaining > 0.0001 && blockIndex < progress.length) {
      const block = progress[blockIndex];
      const residual = roundCurrency(block.totalAmount - block.consumedAmount);
      const applied = Math.min(residual, remaining);

      if (applied > 0.0001) {
        documentCashAllocations.push({
          documentNumber: block.invoiceRef,
          cashMovementKey: movementKey,
          projectName: null,
          allocation_amount: roundCurrency(applied),
          notes:
            "Allocazione documento/incasso ricostruita dalla contabilità interna Diego/Gustare.",
        });
      }

      block.consumedAmount = roundCurrency(block.consumedAmount + applied);
      remaining = roundCurrency(remaining - applied);

      if (roundCurrency(block.totalAmount - block.consumedAmount) <= 0.0001) {
        blockIndex += 1;
      }
    }
  });

  return {
    cashMovements,
    documentCashAllocations,
  };
}

function expandDocumentCashAllocationsByProject(
  documentCashAllocations,
  documentProjectAllocations,
) {
  const projectAllocationsByDocument = new Map();
  const projectRemaindersByDocument = new Map();

  for (const allocation of documentProjectAllocations) {
    const current =
      projectAllocationsByDocument.get(allocation.documentNumber) ?? [];
    current.push(allocation);
    projectAllocationsByDocument.set(allocation.documentNumber, current);
  }

  return documentCashAllocations.flatMap((allocation) => {
    const projectAllocations =
      projectAllocationsByDocument.get(allocation.documentNumber) ?? [];

    if (projectAllocations.length === 0) {
      return [allocation];
    }

    if (!projectRemaindersByDocument.has(allocation.documentNumber)) {
      projectRemaindersByDocument.set(
        allocation.documentNumber,
        projectAllocations.map((projectAllocation) => ({
          projectName: projectAllocation.projectName,
          remaining: roundCurrency(projectAllocation.allocation_amount),
        })),
      );
    }

    const projectRemainders = projectRemaindersByDocument.get(
      allocation.documentNumber,
    );

    let remaining = roundCurrency(allocation.allocation_amount);
    const rows = [];

    for (const projectAllocation of projectRemainders) {
      if (remaining <= 0.0001) break;
      if (projectAllocation.remaining <= 0.0001) continue;

      const applied = Math.min(projectAllocation.remaining, remaining);
      projectAllocation.remaining = roundCurrency(
        projectAllocation.remaining - applied,
      );
      remaining = roundCurrency(remaining - applied);

      rows.push({
        ...allocation,
        projectName: projectAllocation.projectName,
        allocation_amount: roundCurrency(applied),
        notes: makeSourceNote([
          allocation.notes,
          projectAllocation.projectName
            ? `Quota progetto: ${projectAllocation.projectName}`
            : "Quota non allocata a progetto specifico.",
        ]),
      });
    }

    if (remaining > 0.0001) {
      rows.push({
        ...allocation,
        allocation_amount: remaining,
      });
    }

    return rows;
  });
}

function financialDocumentStatus({ totalAmount, settledAmount, dueDate }) {
  const openAmount = roundCurrency(totalAmount - settledAmount);

  if (openAmount <= 0.009) return "settled";
  if (settledAmount > 0.009) return "partial";
  if (dueDate && dueDate < toIsoDate(new Date())) return "overdue";
  return "open";
}

function buildInternalDataset(outgoingIndex) {
  const accountingFiles = [
    path.join(INTERNAL_ACCOUNTING_DIR, "SERVIZI-Tabella 1.csv"),
    path.join(INTERNAL_ACCOUNTING_DIR, "SERVIZI-1-Tabella 1.csv"),
  ];

  const merged = {
    blocks: [],
    paymentEvents: [],
    invoiceSummaries: new Map(),
  };

  for (const filePath of accountingFiles) {
    const parsed = parseAccountingSource(filePath, outgoingIndex);
    merged.blocks.push(...parsed.blocks);
    merged.paymentEvents.push(...parsed.paymentEvents);
    for (const [invoiceRef, summary] of parsed.invoiceSummaries.entries()) {
      merged.invoiceSummaries.set(invoiceRef, summary);
    }
  }

  const settledBlocks = deriveInternalSettlements(
    merged.blocks,
    merged.paymentEvents,
    merged.invoiceSummaries,
    outgoingIndex,
  );

  // Apply Aruba portal truth to settlement blocks whose CSV payment events
  // don't cover the full amount (e.g. FPR 6/25 — Borghi Marinari).
  for (const block of settledBlocks) {
    const portalTruth = ARUBA_PORTAL_TRUTH.get(block.invoiceRef);
    if (portalTruth && block.status !== "ricevuto") {
      block.status = "ricevuto";
      block.settledAt = portalTruth.collectionDate;
    }
  }

  const { cashMovements, documentCashAllocations } =
    deriveInternalCashMovements(settledBlocks, merged.paymentEvents);

  const projectMap = new Map();
  const services = [];
  const expenses = [];
  const payments = [];
  const documentProjectAllocations = [];
  const coveredInvoiceRefs = new Set();
  const kmCarryoverBySourceFile = new Map();
  const reconciliationIssues = [];

  for (const block of settledBlocks) {
    coveredInvoiceRefs.add(block.invoiceRef);

    const groupedByProject = new Map();
    const currentKmByProject = new Map();
    const projectNames = new Set();
    const manualEntries = [];
    const adjustmentEntries = [];

    for (const entry of block.entries) {
      if (entry.kind === "service") {
        registerProject(projectMap, entry.projectName, entry.serviceDate);
        projectNames.add(entry.projectName);

        services.push({
          clientKey: GUSTARE_CLIENT_KEY,
          projectName: entry.projectName,
          service_date: entry.serviceDate,
          service_end: entry.serviceDate,
          all_day: true,
          service_type: entry.serviceType,
          fee_shooting: entry.feeShooting,
          fee_editing: entry.feeEditing,
          fee_other: entry.feeOther,
          km_distance: entry.kmDistance,
          km_rate: KM_RATE,
          location: entry.location,
          invoice_ref: block.invoiceRef,
          notes: makeSourceNote([
            ...entry.notes,
            `Fonte: ${block.sourceFile}`,
            `Blocco contabile: ${block.invoiceRef}`,
          ]),
        });

        if (entry.kmDistance > 0) {
          expenses.push({
            clientKey: GUSTARE_CLIENT_KEY,
            projectName: entry.projectName,
            expense_date: entry.serviceDate,
            expense_type: "spostamento_km",
            km_distance: entry.kmDistance,
            km_rate: KM_RATE,
            amount: null,
            markup_percent: 0,
            description: makeSourceNote([
              `Trasferta ${entry.location || entry.projectName}`,
              `Fonte: ${block.sourceFile}`,
              `Blocco contabile: ${block.invoiceRef}`,
            ]),
            invoice_ref: block.invoiceRef,
          });
        }

        mergeAmountByProject(
          groupedByProject,
          entry.projectName,
          entry.feeShooting + entry.feeEditing + entry.feeOther,
        );

        if (entry.kmDistance > 0) {
          mergeAmountByProject(
            currentKmByProject,
            entry.projectName,
            roundCurrency(entry.kmDistance * KM_RATE),
          );
        }
      }

      if (entry.kind === "manual_expense") manualEntries.push(entry);
      if (entry.kind === "ignored_adjustment") adjustmentEntries.push(entry);
    }

    const carryoverKm = kmCarryoverBySourceFile.get(block.sourceFile) ?? new Map();
    const reconciledSingleProjectName = resolveSingleProjectBlockMatch({
      block,
      projectNames,
      groupedByProject,
      currentKmByProject,
      carryoverKm,
      manualEntries,
      adjustmentEntries,
      outgoingIndex,
    });

    for (const entry of manualEntries) {
      const resolvedProjectName =
        resolveManualExpenseProject(entry, projectNames) ??
        reconciledSingleProjectName;
      const isCreditReceived = (entry.amount ?? 0) < 0;
      const normalizedAmount = isCreditReceived
        ? Math.abs(entry.amount ?? 0)
        : entry.amount;

      expenses.push({
        clientKey: GUSTARE_CLIENT_KEY,
        projectName: resolvedProjectName,
        expense_date: entry.entryDate ?? block.invoiceDate,
        expense_type: isCreditReceived
          ? "credito_ricevuto"
          : "acquisto_materiale",
        km_distance: null,
        km_rate: KM_RATE,
        amount: normalizedAmount,
        markup_percent: 0,
        description: makeSourceNote([
          entry.description,
          `Fonte: ${block.sourceFile}`,
          `Blocco contabile: ${block.invoiceRef}`,
        ]),
        invoice_ref: block.invoiceRef,
      });

      if (!resolvedProjectName) {
        reconciliationIssues.push({
          invoiceRef: block.invoiceRef,
          sourceFile: block.sourceFile,
          kind: "unassigned_manual_entry",
          description: entry.description,
          expenseType: isCreditReceived
            ? "credito_ricevuto"
            : "acquisto_materiale",
          amount: normalizedAmount,
        });
      }

      if (!isCreditReceived) {
        mergeAmountByProject(groupedByProject, resolvedProjectName, entry.amount);
      }
    }

    for (const entry of adjustmentEntries) {
      const resolvedProjectName =
        resolveAdjustmentProject(entry, projectNames) ??
        reconciledSingleProjectName;
      if (!resolvedProjectName) {
        reconciliationIssues.push({
          invoiceRef: block.invoiceRef,
          sourceFile: block.sourceFile,
          kind: "unassigned_adjustment",
          description: entry.note,
          amount: Math.abs(entry.amount ?? 0),
        });
        continue;
      }
      mergeAmountByProject(groupedByProject, resolvedProjectName, entry.amount);
    }

    if ((block.summary?.kmAmount ?? 0) > 0) {
      const kmToBillByProject = new Map();
      mergeProjectTotals(kmToBillByProject, carryoverKm);
      mergeProjectTotals(kmToBillByProject, currentKmByProject);
      mergeProjectTotals(groupedByProject, kmToBillByProject);
      kmCarryoverBySourceFile.delete(block.sourceFile);
    } else {
      const nextCarryover = new Map(carryoverKm);
      mergeProjectTotals(nextCarryover, currentKmByProject);
      kmCarryoverBySourceFile.set(block.sourceFile, nextCarryover);
    }

    const projectEntries = [...groupedByProject.entries()];
    const noteSuffix = makeSourceNote([
      `Fonte: ${block.sourceFile}`,
      `Importo blocco contabile: €${block.totalAmount.toFixed(2)}`,
    ]);

    if (projectEntries.length === 1) {
      const [projectName] = projectEntries[0];
      documentProjectAllocations.push({
        documentNumber: block.invoiceRef,
        projectName,
        allocation_amount: block.totalAmount,
        notes: noteSuffix,
      });
      payments.push({
        clientKey: GUSTARE_CLIENT_KEY,
        projectName,
        payment_date: block.settledAt ?? block.dueDate ?? block.invoiceDate,
        payment_type: "saldo",
        amount: block.totalAmount,
        method: "bonifico",
        invoice_ref: block.invoiceRef,
        status: block.status,
        notes: noteSuffix,
      });
      continue;
    }

    let allocated = 0;
    for (const [projectName, amount] of projectEntries) {
      documentProjectAllocations.push({
        documentNumber: block.invoiceRef,
        projectName,
        allocation_amount: amount,
        notes: noteSuffix,
      });
      payments.push({
        clientKey: GUSTARE_CLIENT_KEY,
        projectName,
        payment_date: block.settledAt ?? block.dueDate ?? block.invoiceDate,
        payment_type: "saldo",
        amount,
        method: "bonifico",
        invoice_ref: block.invoiceRef,
        status: block.status,
        notes: noteSuffix,
      });
      allocated = roundCurrency(allocated + amount);
    }

    const residual = roundCurrency(block.totalAmount - allocated);
    if (Math.abs(residual) >= 0.01 && projectEntries.length > 0) {
      distributeResidualAcrossProjects(groupedByProject, residual);

      documentProjectAllocations.length -= projectEntries.length;
      payments.length -= projectEntries.length;

      for (const [projectName, amount] of groupedByProject.entries()) {
        documentProjectAllocations.push({
          documentNumber: block.invoiceRef,
          projectName,
          allocation_amount: amount,
          notes: makeSourceNote([
            noteSuffix,
            "Quota residua redistribuita sui progetti del blocco per mantenere coerenza con la fonte contabile reale.",
          ]),
        });
        payments.push({
          clientKey: GUSTARE_CLIENT_KEY,
          projectName,
          payment_date: block.settledAt ?? block.dueDate ?? block.invoiceDate,
          payment_type: "saldo",
          amount,
          method: "bonifico",
          invoice_ref: block.invoiceRef,
          status: block.status,
          notes: makeSourceNote([
            noteSuffix,
            "Quota residua redistribuita sui progetti del blocco per mantenere coerenza con la fonte contabile reale.",
          ]),
        });
      }
    }
  }

  const contacts = [
    {
      clientKey: GUSTARE_CLIENT_KEY,
      first_name: "Diego",
      last_name: "Caltabiano",
      title: "Referente operativo",
      contact_role: "operativo",
      is_primary_for_client: true,
      background:
        "Referente operativo ricostruito dalla contabilità interna Diego/Gustare.",
      email_jsonb: [],
      phone_jsonb: [],
    },
  ];

  const projectContacts = [...projectMap.keys()].map((projectName) => ({
    projectName,
    contactDisplayName: "Diego Caltabiano",
    is_primary: projectName === "Gustare Sicilia",
  }));

  const expandedDocumentCashAllocations =
    expandDocumentCashAllocationsByProject(
      documentCashAllocations,
      documentProjectAllocations,
    );

  return {
    projects: [...projectMap.values()],
    services,
    expenses,
    payments,
    cashMovements,
    documentProjectAllocations,
    documentCashAllocations: expandedDocumentCashAllocations,
    contacts,
    projectContacts,
    coveredInvoiceRefs,
    paymentEvents: merged.paymentEvents,
    blocks: settledBlocks,
    reconciliationIssues,
  };
}

function buildXmlDerivedServices(outgoingIndex, coveredInvoiceRefs) {
  const services = [];
  const expenses = [];

  for (const [invoiceRef, supplementary] of SUPPLEMENTARY_OPERATIONAL_TRUTH) {
    if (coveredInvoiceRefs.has(invoiceRef)) continue;

    const xmlInvoice = outgoingIndex.byRef.get(invoiceRef);
    if (!xmlInvoice) continue;

    for (const entry of supplementary.services) {
      services.push({
        clientKey: GUSTARE_CLIENT_KEY,
        projectName: supplementary.projectName,
        service_date: entry.date,
        all_day: true,
        location: entry.location,
        service_type: "riprese_montaggio",
        fee_shooting: supplementary.tariff.feeShooting,
        fee_editing: supplementary.tariff.feeEditing,
        fee_other: 0,
        km_distance: supplementary.kmDistance,
        invoice_ref: invoiceRef,
        notes: makeSourceNote([
          "Servizio derivato da XML + verifica utente/calendario.",
          `Fattura: ${invoiceRef}.`,
          path.relative(process.cwd(), xmlInvoice.filePath),
        ]),
      });
    }

    if (supplementary.kmDistance > 0) {
      expenses.push({
        clientKey: GUSTARE_CLIENT_KEY,
        projectName: supplementary.projectName,
        expense_date: supplementary.services[0]?.date,
        expense_type: "spostamento",
        km_distance: supplementary.kmDistance,
        km_rate: KM_RATE,
        amount: roundCurrency(supplementary.kmDistance * KM_RATE),
        markup_percent: 0,
        description: makeSourceNote([
          `Rimborso km per ${invoiceRef}.`,
          path.relative(process.cwd(), xmlInvoice.filePath),
        ]),
        invoice_ref: invoiceRef,
      });
    }
  }

  return { services, expenses };
}

export function buildLocalTruthDataset() {
  const xmlFiles = listXmlFiles();
  const invoices = xmlFiles.map(parseInvoiceXml);
  const outgoingIndex = buildOutgoingIndex(invoices);
  const internal = buildInternalDataset(outgoingIndex);
  const creditNoteTargets = new Set(
    invoices
      .filter(
        (invoice) =>
          invoice.direction === "outgoing" &&
          invoice.fiscalDocumentType === "customer_credit_note" &&
          invoice.relatedDocumentNumber,
      )
      .map((invoice) => invoice.relatedDocumentNumber),
  );

  const clients = new Map();
  const projectMap = new Map(
    internal.projects.map((project) => [project.name, { ...project }]),
  );
  const projectContactsByName = new Map(
    internal.projectContacts.map((row) => [row.projectName, { ...row }]),
  );

  function registerClient(party, options = {}) {
    const vatNumber = normalizeFiscalIdentifier(
      options.vatNumber ?? party.vatNumber,
    );
    const fiscalCode = normalizeFiscalIdentifier(
      options.fiscalCode ?? party.fiscalCode,
    );
    const name = normalizeCase(options.name ?? party.name);
    const clientKey = makeClientKey({ vatNumber, fiscalCode, name });
    const existing = clients.get(clientKey);

    const next = {
      key: clientKey,
      name,
      client_type: options.clientType ?? inferClientType(name),
      phone: options.phone ?? party.phone ?? existing?.phone ?? null,
      email: options.email ?? party.email ?? existing?.email ?? null,
      address:
        options.address ??
        ([
          party.addressStreet,
          party.addressNumber,
          party.postalCode,
          party.city,
        ]
          .filter(Boolean)
          .join(", ") ||
          existing?.address ||
          null),
      source:
        options.source ??
        existing?.source ??
        (name === GUSTARE_NAME ? "passaparola" : "altro"),
      notes: options.notes ?? existing?.notes ?? null,
      vat_number: vatNumber,
      fiscal_code: fiscalCode,
      billing_name:
        options.billingName ??
        (name === normalizeCase(party.name) ? null : normalizeCase(party.name)),
      billing_address_street:
        options.billingAddressStreet ??
        party.addressStreet ??
        existing?.billing_address_street ??
        null,
      billing_address_number:
        options.billingAddressNumber ??
        party.addressNumber ??
        existing?.billing_address_number ??
        null,
      billing_postal_code:
        options.billingPostalCode ??
        party.postalCode ??
        existing?.billing_postal_code ??
        null,
      billing_city:
        options.billingCity ?? party.city ?? existing?.billing_city ?? null,
      billing_province:
        options.billingProvince ??
        party.province ??
        existing?.billing_province ??
        null,
      billing_country:
        options.billingCountry ??
        party.country ??
        existing?.billing_country ??
        "IT",
      billing_sdi_code:
        options.billingSdiCode ?? existing?.billing_sdi_code ?? null,
      billing_pec:
        options.billingPec ?? party.pec ?? existing?.billing_pec ?? null,
    };

    clients.set(clientKey, next);
    return next;
  }

  // ── Register Aruba client registry BEFORE XML processing ──
  // XLS sets baseline (phone, PEC, SDI, address); XML enriches/overrides.
  for (const entry of ARUBA_CLIENT_REGISTRY) {
    registerClient(
      { name: entry.name, vatNumber: entry.vatNumber, fiscalCode: entry.fiscalCode },
      {
        name: entry.name,
        vatNumber: entry.vatNumber,
        fiscalCode: entry.fiscalCode,
        email: entry.email,
        phone: entry.phone,
        billingPec: entry.billingPec,
        billingSdiCode: entry.billingSdiCode,
        billingAddressStreet: entry.billingAddressStreet,
        billingAddressNumber: entry.billingAddressNumber,
        billingPostalCode: entry.billingPostalCode,
        billingCity: entry.billingCity,
        billingProvince: entry.billingProvince,
        billingCountry: entry.billingCountry,
        clientType: entry.clientType,
        source: null,
      },
    );
  }

  for (const invoice of invoices) {
    const counterparty = registerClient(invoice.counterparty, {
      clientType:
        invoice.counterparty.fiscalCode === GUSTARE_FISCAL_CODE
          ? "produzione_tv"
          : inferClientType(invoice.counterparty.name),
      source:
        invoice.counterparty.fiscalCode === GUSTARE_FISCAL_CODE
          ? "passaparola"
          : "altro",
      notes:
        invoice.direction === "incoming"
          ? makeSourceNote([
              "Controparte importata da fattura ricevuta.",
              path.relative(process.cwd(), invoice.filePath),
            ])
          : null,
      billingSdiCode:
        invoice.direction === "outgoing" ? invoice.receiverSdi : null,
    });

    if (counterparty.name === GUSTARE_NAME) {
      counterparty.notes = makeSourceNote([
        "Cliente fiscale ricostruito da Fatture/ e contabilità interna Diego.",
        "Referente operativo: Diego Caltabiano.",
      ]);
      counterparty.client_type = "produzione_tv";
      counterparty.source = "passaparola";
    }
  }

  const payments = [];
  const expenses = [];
  const financialDocuments = [];
  const cashMovements = [...internal.cashMovements];
  const documentProjectAllocations = [...internal.documentProjectAllocations];
  const documentCashAllocations = [...internal.documentCashAllocations];
  const internalBlockByRef = new Map(
    internal.blocks.map((block) => [block.invoiceRef, block]),
  );
  for (const [invoiceRef, supplementary] of SUPPLEMENTARY_OPERATIONAL_TRUTH) {
    if (supplementary.paymentStatus !== "ricevuto") continue;
    const xmlInvoice = outgoingIndex.byRef.get(invoiceRef);
    if (!xmlInvoice) continue;

    const amount = roundCurrency(xmlInvoice.payableAmount);
    const movementKey = `cash:supplementary:${invoiceRef}:${supplementary.paymentDate}`;

    cashMovements.push({
      key: movementKey,
      clientKey: GUSTARE_CLIENT_KEY,
      projectName: supplementary.projectName,
      direction: "inbound",
      movement_date: supplementary.paymentDate,
      amount,
      method: "bonifico",
      reference: `Incasso ${invoiceRef} confermato dall'utente.`,
      source_path: path.relative(process.cwd(), xmlInvoice.filePath),
      notes: makeSourceNote([
        supplementary.paymentNote,
        path.relative(process.cwd(), xmlInvoice.filePath),
      ]),
    });

    documentCashAllocations.push({
      documentNumber: invoiceRef,
      cashMovementKey: movementKey,
      projectName: supplementary.projectName,
      allocation_amount: amount,
      notes:
        "Allocazione documento/incasso da supplementary operational truth.",
    });
  }

  // Portal cash movements: fill the gap for all Aruba-portal-confirmed
  // invoices that are not yet fully covered by CSV or supplementary truth.
  const settledSoFar = new Map();
  for (const allocation of documentCashAllocations) {
    settledSoFar.set(
      allocation.documentNumber,
      roundCurrency(
        (settledSoFar.get(allocation.documentNumber) ?? 0) +
          allocation.allocation_amount,
      ),
    );
  }

  for (const [invoiceRef, portalEntry] of ARUBA_PORTAL_TRUTH) {
    const xmlInvoice = outgoingIndex.byRef.get(invoiceRef);
    if (!xmlInvoice) continue;
    if (xmlInvoice.fiscalDocumentType !== "customer_invoice") continue;

    const totalAmount = roundCurrency(xmlInvoice.total);
    const payableAmount = roundCurrency(xmlInvoice.payableAmount);
    const alreadySettled = settledSoFar.get(invoiceRef) ?? 0;
    const allocationGap = roundCurrency(totalAmount - alreadySettled);

    if (allocationGap <= 0.01) continue;

    // Actual cash received: use ImportoPagamento when it differs from
    // ImportoTotaleDocumento (e.g. FPR 5/23: €465 vs €372). This matches
    // the Aruba "Incassi" dashboard which tracks real cash, not face value.
    const cashAmount =
      totalAmount > 0 && Math.abs(payableAmount - totalAmount) > 0.01
        ? roundCurrency((payableAmount / totalAmount) * allocationGap)
        : allocationGap;

    const client = registerClient(xmlInvoice.counterparty);
    const movementKey = `cash:portal:${client.key}:${invoiceRef}:${portalEntry.collectionDate}`;

    cashMovements.push({
      key: movementKey,
      clientKey: client.key,
      projectName: null,
      direction: "inbound",
      movement_date: portalEntry.collectionDate,
      amount: cashAmount,
      method: "bonifico",
      reference: `Incasso ${invoiceRef} — portale Aruba.`,
      source_path: path.relative(process.cwd(), xmlInvoice.filePath),
      notes: makeSourceNote([
        `Incassata il ${portalEntry.collectionDate} — fonte: portale Aruba Fatturazione Elettronica.`,
        path.relative(process.cwd(), xmlInvoice.filePath),
      ]),
    });

    documentCashAllocations.push({
      documentNumber: invoiceRef,
      cashMovementKey: movementKey,
      projectName: null,
      allocation_amount: allocationGap,
      notes:
        "Allocazione documento/incasso da portale Aruba Fatturazione Elettronica.",
    });
  }

  const settledAmountByDocumentRef = new Map();

  for (const allocation of documentCashAllocations) {
    const current =
      settledAmountByDocumentRef.get(allocation.documentNumber) ?? 0;
    settledAmountByDocumentRef.set(
      allocation.documentNumber,
      roundCurrency(current + allocation.allocation_amount),
    );
  }

  const documentRefs = new Set();

  for (const invoice of invoices) {
    const client = registerClient(invoice.counterparty);
    const internalBlock = internalBlockByRef.get(invoice.number);
    const totalAmount = roundCurrency(invoice.total);
    const settledAmount = roundCurrency(
      Math.min(
        settledAmountByDocumentRef.get(invoice.number) ?? 0,
        roundCurrency(invoice.total),
      ),
    );
    const openAmount = roundCurrency(Math.max(totalAmount - settledAmount, 0));
    const documentKey = `${invoice.direction}:${client.key}:${invoice.number}:${invoice.issueDate}`;

    financialDocuments.push({
      key: documentKey,
      clientKey: client.key,
      direction: invoice.direction === "incoming" ? "inbound" : "outbound",
      xml_document_code: invoice.xmlDocumentCode,
      document_type: invoice.fiscalDocumentType,
      related_document_number: invoice.relatedDocumentNumber,
      document_number: invoice.number,
      issue_date: invoice.issueDate,
      due_date: invoice.dueDate ?? null,
      total_amount: totalAmount,
      taxable_amount: roundCurrency(invoice.taxableAmount),
      tax_amount: roundCurrency(invoice.taxAmount),
      stamp_amount: roundCurrency(invoice.stampAmount),
      settled_amount: settledAmount,
      open_amount: openAmount,
      settlement_status: financialDocumentStatus({
        totalAmount,
        settledAmount,
        dueDate: invoice.dueDate,
      }),
      source_path: path.relative(process.cwd(), invoice.filePath),
      notes: makeSourceNote([
        invoice.direction === "incoming"
          ? "Documento fiscale ricevuto importato da archivio XML."
          : invoice.fiscalDocumentType === "customer_credit_note"
            ? "Nota di credito emessa importata da archivio XML."
            : "Documento fiscale emesso importato da archivio XML.",
        invoice.relatedDocumentNumber
          ? `Documento collegato: ${invoice.relatedDocumentNumber}.`
          : null,
        internalBlock
          ? "Arricchito con allocazioni e incassi dalla contabilità interna Diego/Gustare."
          : null,
      ]),
    });
    documentRefs.add(invoice.number);

    if (
      invoice.direction === "outgoing" &&
      client.key === GUSTARE_CLIENT_KEY &&
      internal.coveredInvoiceRefs.has(invoice.number)
    ) {
      continue;
    }

    if (
      invoice.direction === "outgoing" &&
      invoice.fiscalDocumentType === "customer_invoice" &&
      creditNoteTargets.has(invoice.number)
    ) {
      continue;
    }

    if (invoice.fiscalDocumentType === "customer_credit_note") {
      continue;
    }

    if (invoice.direction === "outgoing") {
      const inferredProjectName =
        client.key === GUSTARE_CLIENT_KEY
          ? inferProjectFromOutgoingInvoice(invoice)
          : null;
      const operationalStatus = resolveOperationalPaymentStatus(invoice);

      if (inferredProjectName) {
        registerProject(projectMap, inferredProjectName, invoice.issueDate);
        if (!projectContactsByName.has(inferredProjectName)) {
          projectContactsByName.set(inferredProjectName, {
            projectName: inferredProjectName,
            contactDisplayName: "Diego Caltabiano",
            is_primary: inferredProjectName === "Gustare Sicilia",
          });
        }

        documentProjectAllocations.push({
          documentNumber: invoice.number,
          projectName: inferredProjectName,
          allocation_amount: roundCurrency(invoice.payableAmount),
          notes: makeSourceNote([
            "Allocazione progetto inferita dal contenuto della fattura XML.",
            path.relative(process.cwd(), invoice.filePath),
          ]),
        });
      }

      const supplementaryForPayment = SUPPLEMENTARY_OPERATIONAL_TRUTH.get(invoice.number);
      payments.push({
        clientKey: client.key,
        projectName: inferredProjectName,
        payment_date: operationalStatus.paymentDate ?? supplementaryForPayment?.paymentDate ?? invoice.dueDate ?? invoice.issueDate,
        payment_type: "saldo",
        amount: roundCurrency(invoice.payableAmount),
        method: invoice.method,
        invoice_ref: invoice.number,
        status: operationalStatus.status,
        notes: makeSourceNote([
          "Importato da archivio XML fatture emesse.",
          path.relative(process.cwd(), invoice.filePath),
          inferredProjectName
            ? `Progetto inferito: ${inferredProjectName}.`
            : null,
          operationalStatus.note,
          operationalStatus.status === "ricevuto"
            ? "Stato incasso marcato come ricevuto usando la verità operativa fornita dall'utente."
            : "Semantica transitoria: rappresenta documento/credito, non incasso confermato.",
        ]),
      });
      continue;
    }

    if (invoice.fiscalDocumentType === "supplier_credit_note") {
      expenses.push({
        clientKey: client.key,
        projectName: null,
        expense_date: invoice.issueDate,
        expense_type: "credito_ricevuto",
        km_distance: null,
        km_rate: KM_RATE,
        amount: roundCurrency(invoice.total),
        markup_percent: 0,
        description: makeSourceNote([
          `Nota di credito ricevuta ${invoice.number}`,
          invoice.descriptions[0],
          path.relative(process.cwd(), invoice.filePath),
        ]),
        invoice_ref: invoice.number,
      });
      continue;
    }

    expenses.push({
      clientKey: client.key,
      projectName: null,
      expense_date: invoice.issueDate,
      expense_type: "altro",
      km_distance: null,
      km_rate: KM_RATE,
      amount: roundCurrency(invoice.total),
      markup_percent: 0,
      description: makeSourceNote([
        `Fattura ricevuta ${invoice.number}`,
        invoice.descriptions[0],
        path.relative(process.cwd(), invoice.filePath),
      ]),
      invoice_ref: invoice.number,
    });
  }

  for (const block of internal.blocks) {
    if (documentRefs.has(block.invoiceRef)) {
      continue;
    }

    financialDocuments.push({
      key: `outgoing:${GUSTARE_CLIENT_KEY}:${block.invoiceRef}:${block.invoiceDate ?? "unknown"}`,
      clientKey: GUSTARE_CLIENT_KEY,
      direction: "outbound",
      xml_document_code: null,
      document_type: "customer_invoice",
      related_document_number: null,
      document_number: block.invoiceRef,
      issue_date: block.invoiceDate,
      due_date: block.dueDate,
      total_amount: roundCurrency(block.totalAmount),
      taxable_amount: null,
      tax_amount: null,
      stamp_amount: null,
      settled_amount: roundCurrency(
        settledAmountByDocumentRef.get(block.invoiceRef) ?? 0,
      ),
      open_amount: roundCurrency(
        block.totalAmount -
          (settledAmountByDocumentRef.get(block.invoiceRef) ?? 0),
      ),
      settlement_status: financialDocumentStatus({
        totalAmount: block.totalAmount,
        settledAmount: settledAmountByDocumentRef.get(block.invoiceRef) ?? 0,
        dueDate: block.dueDate,
      }),
      source_path: path.join(
        "Fatture",
        "contabilità interna - diego caltabiano",
        block.sourceFile,
      ),
      notes:
        "Documento ricostruito dalla contabilità interna Diego/Gustare in assenza di XML fiscale disponibile nel repo.",
    });
  }

  payments.push(...internal.payments);
  expenses.push(...internal.expenses);

  // ── Inject unfiled operational truth (work done, never invoiced) ──
  const unfiledServices = [];
  for (const entry of UNFILED_OPERATIONAL_TRUTH) {
    let totalFees = 0;
    let totalKmAmount = 0;

    for (const svc of entry.services) {
      registerProject(projectMap, entry.projectName, svc.date);

      const feeShooting = entry.tariff.feeShooting;
      const feeEditing = entry.tariff.feeEditing;
      const kmDist = entry.kmDistance;
      const kmAmount = roundCurrency(kmDist * KM_RATE);
      totalFees += feeShooting + feeEditing;
      totalKmAmount += kmAmount;

      const serviceRecord = {
        clientKey: GUSTARE_CLIENT_KEY,
        projectName: entry.projectName,
        service_date: svc.date,
        service_end: svc.date,
        all_day: true,
        service_type: "riprese_montaggio",
        fee_shooting: feeShooting,
        fee_editing: feeEditing,
        fee_other: 0,
        km_distance: kmDist,
        km_rate: KM_RATE,
        location: svc.location,
        invoice_ref: null,
        notes: makeSourceNote([
          svc.note,
          "Non fatturato — tariffe standard BTF confermate dall'utente.",
        ]),
      };
      unfiledServices.push(serviceRecord);

      if (kmDist > 0) {
        expenses.push({
          clientKey: GUSTARE_CLIENT_KEY,
          projectName: entry.projectName,
          expense_date: svc.date,
          expense_type: "spostamento_km",
          km_distance: kmDist,
          km_rate: KM_RATE,
          amount: null,
          markup_percent: 0,
          description: makeSourceNote([
            `Trasferta ${svc.location}`,
            svc.note,
            "Non fatturato — km standard BTF.",
          ]),
          invoice_ref: null,
        });
      }
    }

    const pendingAmount = roundCurrency(totalFees + totalKmAmount);
    const lastServiceDate =
      entry.services[entry.services.length - 1]?.date ?? "2025-10-21";
    payments.push({
      clientKey: GUSTARE_CLIENT_KEY,
      projectName: entry.projectName,
      payment_date: lastServiceDate,
      payment_type: "saldo",
      amount: pendingAmount,
      method: null,
      invoice_ref: null,
      status: "in_attesa",
      notes: makeSourceNote([entry.paymentNote]),
    });
  }

  const xmlDerived = buildXmlDerivedServices(
    outgoingIndex,
    internal.coveredInvoiceRefs,
  );

  return {
    inventory: {
      xmlInvoiceCount: invoices.length,
      outgoingInvoiceCount: invoices.filter(
        (row) => row.direction === "outgoing",
      ).length,
      incomingInvoiceCount: invoices.filter(
        (row) => row.direction === "incoming",
      ).length,
      accountingCsvCount: 2,
      internalServiceCount: internal.services.length,
      internalExpenseCount: internal.expenses.length,
      internalPaymentCount: internal.payments.length,
      reconciliationIssueCount: internal.reconciliationIssues.length,
      unfiledServiceCount: unfiledServices.length,
      xmlDerivedServiceCount: xmlDerived.services.length,
    },
    clients: [...clients.values()],
    projects: [...projectMap.values()],
    contacts: internal.contacts,
    projectContacts: [...projectContactsByName.values()],
    services: [...internal.services, ...unfiledServices, ...xmlDerived.services],
    financialDocuments,
    cashMovements,
    documentProjectAllocations,
    documentCashAllocations,
    reconciliationIssues: internal.reconciliationIssues,
    payments,
    expenses: [...expenses, ...xmlDerived.expenses],
  };
}

export function buildLocalTruthDebugSnapshot() {
  const xmlFiles = listXmlFiles();
  const invoices = xmlFiles.map(parseInvoiceXml);
  const outgoingIndex = buildOutgoingIndex(invoices);
  const internal = buildInternalDataset(outgoingIndex);

  return {
    inventory: {
      xmlFiles,
    },
    invoices,
    internal,
  };
}
