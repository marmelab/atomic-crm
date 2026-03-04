import { describe, expect, it } from "vitest";

import {
  buildCrmSemanticRegistry,
  calculateKmReimbursement,
  calculateTaxableServiceNetValue,
  getDefaultKmRate,
  isPaymentTaxable,
} from "./crmSemanticRegistry";

describe("crmSemanticRegistry", () => {
  it("builds a registry with dynamic service and quote semantics from configuration", () => {
    const registry = buildCrmSemanticRegistry({
      operationalConfig: { defaultKmRate: 0.42 },
      serviceTypeChoices: [
        {
          value: "riprese",
          label: "Riprese",
          description: "Produzione sul campo",
        },
      ],
      quoteServiceTypes: [
        {
          value: "wedding",
          label: "Wedding",
          description: "Pacchetto matrimonio",
        },
      ],
    });

    expect(registry.dictionaries.serviceTypes).toEqual([
      {
        value: "riprese",
        label: "Riprese",
        description: "Produzione sul campo",
        origin: "configuration",
      },
    ]);
    expect(registry.dictionaries.quoteServiceTypes).toEqual([
      {
        value: "wedding",
        label: "Wedding",
        description: "Pacchetto matrimonio",
        origin: "configuration",
      },
    ]);
    expect(registry.rules.travelReimbursement.defaultKmRate).toBe(0.42);
    expect(registry.rules.travelReimbursement.meaning).toContain(
      "calcolatore tratta manuale",
    );
    expect(registry.rules.travelReimbursement.meaning).toContain(
      "spese, servizi e puntate rapide",
    );
    expect(
      registry.dictionaries.paymentMethods.some(
        (item) => item.value === "bonifico" && item.label === "Bonifico",
      ),
    ).toBe(true);
    expect(registry.rules.quoteStatusEmail.automaticBlockerField).toBe(
      "services.is_taxable",
    );
    expect(registry.rules.quoteStatusEmail.outstandingDueFormula).toContain(
      "status = 'ricevuto'",
    );
    expect(registry.rules.invoiceImport.customerInvoiceResource).toBe(
      "payments",
    );
    expect(registry.rules.invoiceImport.confirmationRule).toContain(
      "conferma esplicita",
    );
    expect(
      registry.fields.descriptions.some(
        (item) =>
          item.resource === "clients" &&
          item.field === "billing_name" &&
          item.meaning.includes("fatturazione"),
      ),
    ).toBe(true);
    expect(registry.rules.invoiceImport.meaning).toContain(
      "form cliente gia precompilato",
    );
    expect(registry.rules.unifiedAiReadContext.freshnessField).toBe(
      "generatedAt",
    );
    expect(registry.rules.unifiedAiReadContext.scope).toContain("quotes");
    expect(registry.rules.unifiedAiReadContext.meaning).toContain(
      "conferma esplicita",
    );
    expect(registry.rules.unifiedAiReadContext.meaning).toContain(
      "route o azioni gia approvate",
    );
    expect(registry.rules.unifiedAiReadContext.meaning).toContain(
      "recommendation primaria",
    );
    expect(registry.rules.unifiedAiReadContext.meaning).toContain(
      "prefills/search params",
    );
    expect(registry.rules.unifiedAiReadContext.meaning).toContain(
      "residuo ancora non collegato",
    );
    expect(registry.rules.unifiedAiReadContext.meaning).toContain(
      "profilo fiscale essenziale",
    );
    expect(registry.rules.unifiedAiReadContext.meaning).toContain(
      "recapiti di fatturazione principali",
    );
    expect(registry.rules.unifiedAiWriteDraft.approvedResource).toBe("payments");
    expect(registry.rules.unifiedAiWriteDraft.confirmationRule).toContain(
      "superfici pagamento",
    );
    expect(registry.rules.unifiedAiWriteDraft.meaning).toContain(
      "preservare quel valore",
    );
    expect(registry.rules.unifiedAiWriteDraft.meaning).toContain(
      "stesso preventivo",
    );
    expect(registry.rules.unifiedAiWriteDraft.meaning).toContain(
      "segnalarlo esplicitamente",
    );
    expect(registry.rules.unifiedAiWriteDraft.meaning).toContain(
      "ricalcolo automatico",
    );
  });

  it("uses km and taxable helpers consistently", () => {
    expect(getDefaultKmRate()).toBe(0.19);
    expect(
      calculateKmReimbursement({
        kmDistance: 100,
        kmRate: null,
        defaultKmRate: 0.3,
      }),
    ).toBe(30);
    expect(
      calculateTaxableServiceNetValue({
        fee_shooting: 200,
        fee_editing: 100,
        fee_other: 50,
        discount: 25,
        is_taxable: true,
      }),
    ).toBe(325);
    expect(
      calculateTaxableServiceNetValue({
        fee_shooting: 200,
        fee_editing: 100,
        fee_other: 50,
        discount: 25,
        is_taxable: false,
      }),
    ).toBe(0);
  });

  it("derives payment taxability from project services or quote fallback", () => {
    expect(
      isPaymentTaxable(
        { project_id: 1, quote_id: null },
        {
          projectServices: [{ is_taxable: false }, { is_taxable: true }],
          quote: { is_taxable: false },
        },
      ),
    ).toBe(true);

    expect(
      isPaymentTaxable(
        { project_id: 1, quote_id: null },
        {
          projectServices: [{ is_taxable: false }],
        },
      ),
    ).toBe(false);

    expect(
      isPaymentTaxable(
        { project_id: null, quote_id: "q-1" },
        {
          projectServices: [],
          quote: { is_taxable: false },
        },
      ),
    ).toBe(false);

    expect(
      isPaymentTaxable(
        { project_id: null, quote_id: null },
        {
          projectServices: [],
          quote: null,
        },
      ),
    ).toBe(true);
  });
});
