import { describe, expect, it } from "vitest";

import type { BusinessProfile, Client } from "../types";
import type { InvoiceDraftInput } from "./invoiceDraftTypes";
import { buildInvoiceDraftXml } from "./invoiceDraftXml";

// ── Fixtures aligned with real Aruba invoice ─────────────────────────
// Reference: Fatture/2025/IT01879020517A2025_aGgQD.xml

const testIssuer: BusinessProfile = {
  name: "Rosario Furnari",
  tagline: "Videomaker · Fotografo · Web Developer",
  vatNumber: "01309870861",
  fiscalCode: "FRNRRD87A11G580E",
  sdiCode: "KRRH6B9",
  iban: "IT88L0200883730000430121067",
  bankName: "UNICREDIT",
  bic: "UNCRITM1L81",
  address: "Via Calabria 13, 94019 Valguarnera Caropepe EN",
  addressStreet: "Via Calabria",
  addressNumber: "13",
  addressPostalCode: "94019",
  addressCity: "Valguarnera Caropepe",
  addressProvince: "EN",
  addressCountry: "IT",
  email: "rosariodavide.furnari@gmail.com",
  phone: "3286183554",
  beneficiaryName: "Rosario Davide Furnari",
};

const testClient: Client = {
  id: 1,
  name: "ASSOCIAZIONE CULTURALE GUSTARE SICILIA",
  client_type: "produzione_tv",
  fiscal_code: "05416820875",
  billing_address_street: "Via Marino",
  billing_postal_code: "95031",
  billing_city: "Adrano",
  billing_province: "CT",
  billing_country: "IT",
  billing_sdi_code: "KRRH6B9",
  tags: [],
  created_at: "2025-01-01",
  updated_at: "2025-01-01",
};

const testDraft: InvoiceDraftInput = {
  client: testClient,
  lineItems: [
    {
      description:
        "Servizio di Riprese e Montaggio (Gustare Sicilia e Bella Tra I Fornelli)",
      quantity: 1,
      unitPrice: 5113,
    },
  ],
  invoiceDate: "2025-02-01",
  source: { kind: "project", id: "proj-1", label: "Gustare Sicilia" },
};

// ── Parse helper ─────────────────────────────────────────────────────

/** Simple tag content extractor (no nested tags with same name). */
const getTag = (xml: string, tagName: string): string | null => {
  const re = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`);
  const m = xml.match(re);
  return m ? m[1].trim() : null;
};

/** Get all occurrences of a tag block. */
const getAllTags = (xml: string, tagName: string): string[] => {
  const re = new RegExp(`<${tagName}>[\\s\\S]*?</${tagName}>`, "g");
  return [...xml.matchAll(re)].map((m) => m[0]);
};

// ── Tests ────────────────────────────────────────────────────────────

describe("buildInvoiceDraftXml", () => {
  const xml = buildInvoiceDraftXml({
    draft: testDraft,
    issuer: testIssuer,
    invoiceNumber: "FPR 1/25",
    progressivoInvio: "1",
  });

  describe("XML envelope", () => {
    it("starts with XML declaration", () => {
      expect(xml).toMatch(/^<\?xml version="1\.0" encoding="utf-8"\?>/);
    });

    it("has FatturaElettronica root with versione FPR12", () => {
      expect(xml).toContain('versione="FPR12"');
    });

    it("has correct namespace", () => {
      expect(xml).toContain(
        'xmlns="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2"',
      );
    });
  });

  describe("DatiTrasmissione", () => {
    it("has Aruba PEC fiscal code as IdTrasmittente", () => {
      const idTrasmittente = getTag(xml, "IdTrasmittente")!;
      expect(getTag(idTrasmittente, "IdPaese")).toBe("IT");
      expect(getTag(idTrasmittente, "IdCodice")).toBe("01879020517");
    });

    it("has FormatoTrasmissione FPR12", () => {
      expect(getTag(xml, "FormatoTrasmissione")).toBe("FPR12");
    });

    it("has ProgressivoInvio", () => {
      expect(getTag(xml, "ProgressivoInvio")).toBe("1");
    });

    it("has client SDI code as CodiceDestinatario", () => {
      expect(getTag(xml, "CodiceDestinatario")).toBe("KRRH6B9");
    });
  });

  describe("CedentePrestatore (issuer)", () => {
    it("has issuer P.IVA with IT prefix", () => {
      const cedente = getTag(xml, "CedentePrestatore")!;
      const idFiscale = getTag(cedente, "IdFiscaleIVA")!;
      expect(getTag(idFiscale, "IdPaese")).toBe("IT");
      expect(getTag(idFiscale, "IdCodice")).toBe("01309870861");
    });

    it("has issuer CodiceFiscale", () => {
      const cedente = getTag(xml, "CedentePrestatore")!;
      expect(getTag(cedente, "CodiceFiscale")).toBe("FRNRRD87A11G580E");
    });

    it("has issuer Denominazione", () => {
      const cedente = getTag(xml, "CedentePrestatore")!;
      expect(getTag(cedente, "Denominazione")).toBe("Rosario Furnari");
    });

    it("has RegimeFiscale RF19 (forfettario)", () => {
      expect(getTag(xml, "RegimeFiscale")).toBe("RF19");
    });

    it("has structured Sede (street, number, CAP, city, province, country)", () => {
      const cedente = getTag(xml, "CedentePrestatore")!;
      const sede = getTag(cedente, "Sede")!;
      expect(getTag(sede, "Indirizzo")).toBe("Via Calabria");
      expect(getTag(sede, "NumeroCivico")).toBe("13");
      expect(getTag(sede, "CAP")).toBe("94019");
      expect(getTag(sede, "Comune")).toBe("Valguarnera Caropepe");
      expect(getTag(sede, "Provincia")).toBe("EN");
      expect(getTag(sede, "Nazione")).toBe("IT");
    });

    it("has Contatti (phone, email)", () => {
      const cedente = getTag(xml, "CedentePrestatore")!;
      const contatti = getTag(cedente, "Contatti")!;
      expect(getTag(contatti, "Telefono")).toBe("3286183554");
      expect(getTag(contatti, "Email")).toBe("rosariodavide.furnari@gmail.com");
    });
  });

  describe("CessionarioCommittente (client)", () => {
    it("has client CodiceFiscale", () => {
      const cessionario = getTag(xml, "CessionarioCommittente")!;
      expect(getTag(cessionario, "CodiceFiscale")).toBe("05416820875");
    });

    it("has client Denominazione", () => {
      const cessionario = getTag(xml, "CessionarioCommittente")!;
      expect(getTag(cessionario, "Denominazione")).toBe(
        "ASSOCIAZIONE CULTURALE GUSTARE SICILIA",
      );
    });

    it("has client Sede", () => {
      const cessionario = getTag(xml, "CessionarioCommittente")!;
      const sede = getTag(cessionario, "Sede")!;
      expect(getTag(sede, "Indirizzo")).toBe("Via Marino");
      expect(getTag(sede, "CAP")).toBe("95031");
      expect(getTag(sede, "Comune")).toBe("Adrano");
      expect(getTag(sede, "Provincia")).toBe("CT");
      expect(getTag(sede, "Nazione")).toBe("IT");
    });
  });

  describe("DatiGeneraliDocumento", () => {
    it("has TipoDocumento TD01", () => {
      expect(getTag(xml, "TipoDocumento")).toBe("TD01");
    });

    it("has Divisa EUR", () => {
      expect(getTag(xml, "Divisa")).toBe("EUR");
    });

    it("has correct Data", () => {
      expect(getTag(xml, "Data")).toBe("2025-02-01");
    });

    it("has correct Numero", () => {
      expect(getTag(xml, "Numero")).toBe("FPR 1/25");
    });

    it("has ImportoTotaleDocumento matching total", () => {
      expect(getTag(xml, "ImportoTotaleDocumento")).toBe("5115.00");
      // 5113 + 2 (stamp duty) = 5115
    });

    it("has Causale with forfettario legal text", () => {
      const causale = getTag(xml, "Causale")!;
      expect(causale).toContain("articolo 1, comma 67");
      expect(causale).toContain("l. n. 190 del 2014");
    });
  });

  describe("DettaglioLinee", () => {
    it("has one line item", () => {
      const linee = getAllTags(xml, "DettaglioLinee");
      expect(linee).toHaveLength(1);
    });

    it("has correct NumeroLinea", () => {
      const linea = getAllTags(xml, "DettaglioLinee")[0];
      expect(getTag(linea, "NumeroLinea")).toBe("1");
    });

    it("has correct Descrizione", () => {
      const linea = getAllTags(xml, "DettaglioLinee")[0];
      expect(getTag(linea, "Descrizione")).toBe(
        "Servizio di Riprese e Montaggio (Gustare Sicilia e Bella Tra I Fornelli)",
      );
    });

    it("has correct Quantita", () => {
      const linea = getAllTags(xml, "DettaglioLinee")[0];
      expect(getTag(linea, "Quantita")).toBe("1.00");
    });

    it("has correct PrezzoUnitario", () => {
      const linea = getAllTags(xml, "DettaglioLinee")[0];
      expect(getTag(linea, "PrezzoUnitario")).toBe("5113.00");
    });

    it("has correct PrezzoTotale", () => {
      const linea = getAllTags(xml, "DettaglioLinee")[0];
      expect(getTag(linea, "PrezzoTotale")).toBe("5113.00");
    });

    it("has AliquotaIVA 0.00", () => {
      const linea = getAllTags(xml, "DettaglioLinee")[0];
      expect(getTag(linea, "AliquotaIVA")).toBe("0.00");
    });

    it("has Natura N2.2", () => {
      const linea = getAllTags(xml, "DettaglioLinee")[0];
      expect(getTag(linea, "Natura")).toBe("N2.2");
    });
  });

  describe("DatiRiepilogo", () => {
    it("has AliquotaIVA 0.00", () => {
      const riepilogo = getTag(xml, "DatiRiepilogo")!;
      expect(getTag(riepilogo, "AliquotaIVA")).toBe("0.00");
    });

    it("has Natura N2.2", () => {
      const riepilogo = getTag(xml, "DatiRiepilogo")!;
      expect(getTag(riepilogo, "Natura")).toBe("N2.2");
    });

    it("has ImponibileImporto matching total (includes stamp duty)", () => {
      const riepilogo = getTag(xml, "DatiRiepilogo")!;
      expect(getTag(riepilogo, "ImponibileImporto")).toBe("5115.00");
    });

    it("has Imposta 0.00", () => {
      const riepilogo = getTag(xml, "DatiRiepilogo")!;
      expect(getTag(riepilogo, "Imposta")).toBe("0.00");
    });

    it("has RiferimentoNormativo", () => {
      const riepilogo = getTag(xml, "DatiRiepilogo")!;
      expect(getTag(riepilogo, "RiferimentoNormativo")).toBe(
        "Non soggette - altri casi",
      );
    });
  });

  describe("DatiPagamento", () => {
    it("has CondizioniPagamento TP02 (pagamento completo)", () => {
      expect(getTag(xml, "CondizioniPagamento")).toBe("TP02");
    });

    it("has Beneficiario", () => {
      expect(getTag(xml, "Beneficiario")).toBe("Rosario Davide Furnari");
    });

    it("has ModalitaPagamento MP05 (bonifico)", () => {
      expect(getTag(xml, "ModalitaPagamento")).toBe("MP05");
    });

    it("has ImportoPagamento matching total", () => {
      expect(getTag(xml, "ImportoPagamento")).toBe("5115.00");
    });

    it("has IstitutoFinanziario", () => {
      expect(getTag(xml, "IstitutoFinanziario")).toBe("UNICREDIT");
    });

    it("has IBAN", () => {
      expect(getTag(xml, "IBAN")).toBe("IT88L0200883730000430121067");
    });

    it("has BIC", () => {
      expect(getTag(xml, "BIC")).toBe("UNCRITM1L81");
    });
  });

  describe("Bollo handling", () => {
    it("does NOT include DatiBollo in XML (Aruba handles it)", () => {
      expect(xml).not.toContain("<DatiBollo>");
      expect(xml).not.toContain("<BolloVirtuale>");
    });

    it("stamp duty IS included in totals (ImportoTotaleDocumento)", () => {
      // 5113 (service) + 2 (stamp) = 5115
      expect(getTag(xml, "ImportoTotaleDocumento")).toBe("5115.00");
    });
  });

  describe("PEC fallback when no SDI code", () => {
    it("uses 0000000 + PECDestinatario when client has no SDI code but has PEC", () => {
      const clientWithPec: Client = {
        ...testClient,
        billing_sdi_code: undefined,
        billing_pec: "gustare@pec.it",
      };
      const xmlPec = buildInvoiceDraftXml({
        draft: { ...testDraft, client: clientWithPec },
        issuer: testIssuer,
        invoiceNumber: "FPR 2/25",
      });
      expect(getTag(xmlPec, "CodiceDestinatario")).toBe("0000000");
      expect(getTag(xmlPec, "PECDestinatario")).toBe("gustare@pec.it");
    });

    it("uses 0000000 without PEC when client has neither", () => {
      const clientNone: Client = {
        ...testClient,
        billing_sdi_code: undefined,
        billing_pec: undefined,
      };
      const xmlNone = buildInvoiceDraftXml({
        draft: { ...testDraft, client: clientNone },
        issuer: testIssuer,
        invoiceNumber: "FPR 3/25",
      });
      expect(getTag(xmlNone, "CodiceDestinatario")).toBe("0000000");
      expect(xmlNone).not.toContain("<PECDestinatario>");
    });
  });

  describe("Multiple line items", () => {
    it("generates correct NumeroLinea for each line", () => {
      const multiDraft: InvoiceDraftInput = {
        ...testDraft,
        lineItems: [
          { description: "Riprese", quantity: 2, unitPrice: 500 },
          { description: "Montaggio", quantity: 1, unitPrice: 300 },
        ],
      };
      const xmlMulti = buildInvoiceDraftXml({
        draft: multiDraft,
        issuer: testIssuer,
        invoiceNumber: "FPR 4/25",
      });
      const linee = getAllTags(xmlMulti, "DettaglioLinee");
      expect(linee).toHaveLength(2);
      expect(getTag(linee[0], "NumeroLinea")).toBe("1");
      expect(getTag(linee[1], "NumeroLinea")).toBe("2");
      expect(getTag(linee[0], "PrezzoTotale")).toBe("1000.00");
      expect(getTag(linee[1], "PrezzoTotale")).toBe("300.00");
    });
  });

  describe("XML escaping", () => {
    it("escapes special characters in description", () => {
      const specialDraft: InvoiceDraftInput = {
        ...testDraft,
        lineItems: [
          {
            description: 'Servizio "A&B" <test>',
            quantity: 1,
            unitPrice: 100,
          },
        ],
      };
      const xmlSpecial = buildInvoiceDraftXml({
        draft: specialDraft,
        issuer: testIssuer,
        invoiceNumber: "FPR 5/25",
      });
      expect(xmlSpecial).toContain("&amp;");
      expect(xmlSpecial).toContain("&lt;");
      expect(xmlSpecial).toContain("&gt;");
      expect(xmlSpecial).toContain("&quot;");
    });
  });

  describe("Client with IdFiscaleIVA", () => {
    it("uses IdFiscaleIVA when client has vat_number", () => {
      const clientVat: Client = {
        ...testClient,
        vat_number: "12345678901",
      };
      const xmlVat = buildInvoiceDraftXml({
        draft: { ...testDraft, client: clientVat },
        issuer: testIssuer,
        invoiceNumber: "FPR 6/25",
      });
      const cessionario = getTag(xmlVat, "CessionarioCommittente")!;
      const idFiscale = getTag(cessionario, "IdFiscaleIVA")!;
      expect(getTag(idFiscale, "IdPaese")).toBe("IT");
      expect(getTag(idFiscale, "IdCodice")).toBe("12345678901");
    });
  });
});
