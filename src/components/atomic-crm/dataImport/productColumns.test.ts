import { describe, expect, it } from "vitest";

import { toCounterparty, toRoles } from "./counterpartyColumns";
import { toBarcodes, toKind, toUnit, toVatRateCode } from "./useProductImport";

const UA_RATES = [
  { code: "standard", rate: 20, label: "VAT 20%" },
  { code: "reduced_7", rate: 7, label: "VAT 7%" },
  { code: "zero", rate: 0, label: "VAT 0%" },
];

describe("product CSV columns", () => {
  it("reads the kind as a code or a Ukrainian word, goods by default", () => {
    expect(toKind("material")).toBe("material");
    expect(toKind("Послуга")).toBe("service");
    expect(toKind("")).toBe("goods");
    expect(toKind("something else")).toBe("goods");
  });

  it("reads the unit as a code or as people write it", () => {
    expect(toUnit("kg", "goods")).toBe("kg");
    expect(toUnit("шт", "goods")).toBe("pcs");
    expect(toUnit("уп.", "material")).toBe("pack");
    expect(toUnit("", "service")).toBe("service");
    expect(toUnit("parsec", "goods")).toBe("pcs");
  });

  it("finds the VAT rate of the country pack by percent or code", () => {
    expect(toVatRateCode("20", UA_RATES)).toBe("standard");
    expect(toVatRateCode("7%", UA_RATES)).toBe("reduced_7");
    expect(toVatRateCode(0, UA_RATES)).toBe("zero");
    expect(toVatRateCode("standard", UA_RATES)).toBe("standard");
    expect(toVatRateCode("23", UA_RATES)).toBeUndefined();
  });

  it("splits several barcodes in one cell", () => {
    expect(toBarcodes("4820000000017; 4820000000024")).toEqual([
      "4820000000017",
      "4820000000024",
    ]);
    expect(toBarcodes(null)).toEqual([]);
  });
});

describe("counterparty CSV columns", () => {
  it("reads several roles in English or Ukrainian, client by default", () => {
    expect(toRoles("client;supplier")).toEqual(["client", "supplier"]);
    expect(toRoles("Постачальник, партнер")).toEqual(["supplier", "partner"]);
    expect(toRoles("")).toEqual(["client"]);
  });

  it("keeps only the filled requisites of the row", () => {
    const counterparty = toCounterparty({
      name: "Kvitka",
      kind: "ФОП",
      roles: "supplier",
      country_code: "ua",
      ipn: "3006815078",
      edrpou: null,
      payment_terms_days: 14,
    });
    expect(counterparty).toMatchObject({
      kind: "sole_proprietor",
      roles: ["supplier"],
      country_code: "UA",
      requisites: { ipn: "3006815078" },
      payment_terms_days: 14,
    });
  });
});
