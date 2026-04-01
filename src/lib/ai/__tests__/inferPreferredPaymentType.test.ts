import { describe, expect, it } from "vitest";
import { inferPreferredPaymentType } from "../inferPreferredPaymentType";

describe("inferPreferredPaymentType", () => {
  it("maps 'rimborso spese' to rimborso_spese", () => {
    expect(inferPreferredPaymentType("registra rimborso spese")).toBe(
      "rimborso_spese",
    );
  });
  it("maps 'spes' to rimborso_spese", () => {
    expect(inferPreferredPaymentType("spese viaggio")).toBe("rimborso_spese");
  });
  it("maps 'rimborso' alone to rimborso (NOT rimborso_spese)", () => {
    expect(inferPreferredPaymentType("registra un rimborso al cliente")).toBe(
      "rimborso",
    );
  });
  it("maps 'acconto' to acconto", () => {
    expect(inferPreferredPaymentType("registra acconto")).toBe("acconto");
  });
  it("maps 'saldo' to saldo", () => {
    expect(inferPreferredPaymentType("registra saldo")).toBe("saldo");
  });
  it("maps 'parziale' to parziale", () => {
    expect(inferPreferredPaymentType("pagamento parziale")).toBe("parziale");
  });
  it("returns null for unrecognized input", () => {
    expect(inferPreferredPaymentType("ciao come stai")).toBeNull();
  });
});
