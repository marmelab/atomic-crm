import { describe, expect, it } from "vitest";

import {
  buildLocalTruthDataset,
  buildLocalTruthDebugSnapshot,
} from "./local-truth-data.mjs";

describe("local truth rebuild dataset", () => {
  it("reads the real source inventory and rebuilds the Diego/Gustare core domain", () => {
    const dataset = buildLocalTruthDataset();

    expect(dataset.inventory).toEqual({
      xmlInvoiceCount: 40,
      outgoingInvoiceCount: 31,
      incomingInvoiceCount: 9,
      accountingCsvCount: 2,
      internalServiceCount: 61,
      internalExpenseCount: 43,
      internalPaymentCount: 16,
      reconciliationIssueCount: 1,
      unfiledServiceCount: 5,
      xmlDerivedServiceCount: 4,
    });

    expect(dataset.projects).toHaveLength(12);
    expect(dataset.contacts).toHaveLength(1);
    expect(dataset.projectContacts).toHaveLength(11);

    const gustare = dataset.clients.find(
      (client) => client.name === "ASSOCIAZIONE CULTURALE GUSTARE SICILIA",
    );

    expect(gustare).toMatchObject({
      client_type: "produzione_tv",
      fiscal_code: "05416820875",
    });

    expect(dataset.contacts[0]).toMatchObject({
      first_name: "Diego",
      last_name: "Caltabiano",
      contact_role: "operativo",
      is_primary_for_client: true,
    });

    expect(
      dataset.projects.some(
        (project) => project.name === "Gustare Sicilia — Nisseno",
      ),
    ).toBe(true);
    expect(
      dataset.projects.some(
        (project) => project.name === "Spot Camping Carratois",
      ),
    ).toBe(true);
  });

  it("keeps the internal accounting settlement semantics aligned with the real files", () => {
    const { internal } = buildLocalTruthDebugSnapshot();
    const byRef = new Map(
      internal.blocks.map((block) => [block.invoiceRef, block]),
    );

    expect(byRef.get("FPR 7/24")).toMatchObject({
      totalAmount: 997,
      settledAt: "2024-12-27",
      status: "ricevuto",
    });

    expect(byRef.get("FPR 1/25")).toMatchObject({
      totalAmount: 5115,
      settledAt: "2025-03-03",
      status: "ricevuto",
    });

    expect(byRef.get("FPR 2/25")).toMatchObject({
      totalAmount: 6295.19,
      settledAt: "2025-05-14",
      status: "ricevuto",
    });

    expect(byRef.get("FPR 4/25")).toMatchObject({
      totalAmount: 2682.35,
      settledAt: "2025-10-14",
      status: "ricevuto",
    });

    expect(byRef.get("FPR 6/25")).toMatchObject({
      totalAmount: 7152.1,
      settledAt: "2025-11-11",
      status: "ricevuto",
    });
  });

  it("applies Aruba portal truth: exact collection dates for 2023/2024/2025 invoices", () => {
    const dataset = buildLocalTruthDataset();
    const byRef = new Map(
      dataset.payments.map((payment) => [payment.invoice_ref, payment]),
    );

    // ── 2023 ──
    expect(byRef.get("FPR 2/23")).toMatchObject({
      status: "ricevuto",
      payment_date: "2023-10-25",
    });
    expect(byRef.get("FPR 6/23")).toMatchObject({
      status: "ricevuto",
      payment_date: "2023-10-31",
    });
    expect(byRef.get("FPR 10/23")).toMatchObject({
      status: "ricevuto",
      payment_date: "2024-01-30",
    });
    // FPA 1/23: "Non incassata" per il portale Aruba — must remain scaduto
    expect(byRef.get("FPA 1/23")).toMatchObject({
      status: "scaduto",
    });

    // ── 2024 ──
    expect(byRef.get("FPR 1/24")).toMatchObject({
      status: "ricevuto",
      payment_date: "2024-01-07",
    });
    expect(byRef.get("FPR 2/24")).toMatchObject({
      status: "ricevuto",
      payment_date: "2024-02-15",
    });
    expect(byRef.get("FPR 5/24")).toMatchObject({
      status: "ricevuto",
      payment_date: "2024-09-13",
    });

    // ── 2025 non-Gustare ──
    expect(byRef.get("FPA 3/25")).toMatchObject({
      status: "ricevuto",
      payment_date: "2025-05-20",
    });
    expect(byRef.get("FPR 3/25")).toMatchObject({
      status: "ricevuto",
      payment_date: "2025-07-08",
    });
    expect(byRef.get("FPA 4/25")).toMatchObject({
      status: "ricevuto",
      payment_date: "2025-07-23",
    });
    expect(byRef.get("FPR 5/25")).toMatchObject({
      status: "ricevuto",
      payment_date: "2025-10-31",
    });
    expect(byRef.get("FPR 7/25")).toMatchObject({
      status: "ricevuto",
      payment_date: "2025-12-23",
    });
    expect(byRef.get("FPR 8/25")).toMatchObject({
      status: "ricevuto",
      payment_date: "2025-12-27",
    });

    // ── 2025 Gustare CSV-covered ──
    // FPR 6/25 (Borghi Marinari): CSV didn't cover the payment, portal overrides
    expect(byRef.get("FPR 6/25")).toMatchObject({
      status: "ricevuto",
    });
  });

  it("does not depend on the removed Diego fixture bootstrap for the core relationships", () => {
    const dataset = buildLocalTruthDataset();

    const gustareProject = dataset.projectContacts.find(
      (row) => row.projectName === "Gustare Sicilia",
    );
    const btfProject = dataset.projectContacts.find(
      (row) => row.projectName === "Bella tra i Fornelli",
    );

    expect(gustareProject).toMatchObject({
      contactDisplayName: "Diego Caltabiano",
      is_primary: true,
    });

    expect(btfProject).toMatchObject({
      contactDisplayName: "Diego Caltabiano",
      is_primary: false,
    });
  });

  it("imports received supplier invoices as real expense rows from the fatture_ricevute folders", () => {
    const dataset = buildLocalTruthDataset();
    const clientNameByKey = new Map(
      dataset.clients.map((client) => [client.key, client.name]),
    );

    const receivedInvoices = dataset.expenses.filter((expense) =>
      expense.description?.includes("fatture_ricevute/"),
    );

    expect(receivedInvoices).toHaveLength(9);

    const totalsByYear = Object.fromEntries(
      ["2023", "2024", "2025"].map((year) => {
        const yearRows = receivedInvoices.filter((expense) =>
          expense.expense_date.startsWith(year),
        );
        const total = yearRows.reduce(
          (sum, expense) => sum + Number(expense.amount ?? 0),
          0,
        );
        return [year, Math.round(total * 100) / 100];
      }),
    );

    expect(totalsByYear).toEqual({
      2023: 351.72,
      2024: 1013.67,
      2025: 704.06,
    });

    const totalsByVendor = Object.fromEntries(
      [...new Set(receivedInvoices.map((expense) => expense.clientKey))].map(
        (clientKey) => {
          const vendorRows = receivedInvoices.filter(
            (expense) => expense.clientKey === clientKey,
          );
          const total = vendorRows.reduce(
            (sum, expense) => sum + Number(expense.amount ?? 0),
            0,
          );
          return [
            clientNameByKey.get(clientKey) ?? clientKey,
            Math.round(total * 100) / 100,
          ];
        },
      ),
    );

    expect(totalsByVendor).toEqual({
      "ARUBA SPA": 222.4,
      "FABIO STEFANO CAPIZZI": 1522.56,
      "DHL EXPRESS (ITALY) S.R.L.": 324.49,
    });
  });

  it("keeps the iPhone sale as a real credito_ricevuto on Borghi Marinari instead of dropping it", () => {
    const dataset = buildLocalTruthDataset();
    const iphoneExpense = dataset.expenses.find((expense) =>
      /vendita iphone/i.test(expense.description ?? ""),
    );

    expect(iphoneExpense).toMatchObject({
      projectName: "Gustare Sicilia — Borghi Marinari",
      invoice_ref: "FPR 6/25",
      expense_type: "credito_ricevuto",
      amount: 500,
    });
  });

  it("builds a separate financial document and cash movement foundation from the same real sources", () => {
    const dataset = buildLocalTruthDataset();

    expect(dataset.financialDocuments).toHaveLength(40);
    expect(dataset.cashMovements).toHaveLength(33);
    expect(dataset.documentProjectAllocations.length).toBeGreaterThan(0);
    expect(dataset.documentCashAllocations.length).toBeGreaterThan(0);

    const byNumber = new Map(
      dataset.financialDocuments.map((document) => [
        `${document.direction}:${document.document_number}`,
        document,
      ]),
    );

    expect(byNumber.get("outbound:FPR 1/25")).toMatchObject({
      document_type: "customer_invoice",
      total_amount: 5113,
      settled_amount: 5113,
      open_amount: 0,
      settlement_status: "settled",
    });

    expect(byNumber.get("outbound:FPR 6/25")).toMatchObject({
      document_type: "customer_invoice",
      total_amount: 7154,
      settled_amount: 7154,
      open_amount: 0,
      settlement_status: "settled",
    });

    expect(byNumber.get("outbound:FPA 2/25")).toMatchObject({
      xml_document_code: "TD04",
      document_type: "customer_credit_note",
      total_amount: 200,
      related_document_number: "FPA 1/25",
    });

    expect(byNumber.get("inbound:28")).toMatchObject({
      document_type: "supplier_invoice",
      total_amount: 634.4,
      settled_amount: 0,
      open_amount: 634.4,
    });

    const passiveInbound2025 = dataset.financialDocuments
      .filter(
        (document) =>
          document.direction === "inbound" &&
          document.issue_date.startsWith("2025-"),
      )
      .reduce(
        (acc, document) => {
          const sign =
            document.document_type === "supplier_credit_note" ? -1 : 1;
          acc.gross += sign * Number(document.total_amount ?? 0);
          acc.taxable += sign * Number(document.taxable_amount ?? 0);
          acc.tax += sign * Number(document.tax_amount ?? 0);
          acc.stamp += sign * Number(document.stamp_amount ?? 0);
          return acc;
        },
        { gross: 0, taxable: 0, tax: 0, stamp: 0 },
      );

    expect({
      gross: Math.round(passiveInbound2025.gross * 100) / 100,
      taxable: Math.round(passiveInbound2025.taxable * 100) / 100,
      tax: Math.round(passiveInbound2025.tax * 100) / 100,
      stamp: Math.round(passiveInbound2025.stamp * 100) / 100,
    }).toEqual({
      gross: 704.06,
      taxable: 577.1,
      tax: 126.96,
      stamp: 0,
    });

    expect(byNumber.get("outbound:FPR 1/25")?.source_path).toContain(
      "Fatture/2025/IT01879020517A2025_aGgQD.xml",
    );

    const voidedOutboundInvoices = new Set(
      dataset.financialDocuments
        .filter(
          (document) =>
            document.direction === "outbound" &&
            document.document_type === "customer_credit_note" &&
            document.related_document_number,
        )
        .map((document) => document.related_document_number),
    );

    const activeOutbound2025 = dataset.financialDocuments
      .filter(
        (document) =>
          document.direction === "outbound" &&
          document.issue_date.startsWith("2025-") &&
          document.document_type === "customer_invoice" &&
          !voidedOutboundInvoices.has(document.document_number),
      )
      .reduce((sum, document) => sum + Number(document.total_amount ?? 0), 0);

    expect(Math.round(activeOutbound2025 * 100) / 100).toBe(26700.35);

    const cashByDocumentAndProject = dataset.documentCashAllocations.reduce(
      (acc, allocation) => {
        const key = `${allocation.documentNumber}::${allocation.projectName ?? "(none)"}`;
        acc.set(
          key,
          Math.round(
            ((acc.get(key) ?? 0) + allocation.allocation_amount) * 100,
          ) / 100,
        );
        return acc;
      },
      new Map(),
    );

    expect(cashByDocumentAndProject.get("FPR 1/25::Gustare Sicilia")).toBe(
      2492,
    );
    expect(cashByDocumentAndProject.get("FPR 1/25::Bella tra i Fornelli")).toBe(
      1623,
    );
    // Portal cash movement covers the full amount (CSV had zero for this block)
    expect(
      cashByDocumentAndProject.get("FPR 6/25::(none)"),
    ).toBe(7154);
  });

  it("parses corrected dates for Ragalna, Santocchini, HCLINIC, Pasticceria Vittoria", () => {
    const dataset = buildLocalTruthDataset();

    const ragalna = dataset.services.find((s) =>
      /ragalna/i.test(s.location ?? ""),
    );
    expect(ragalna.service_date).toBe("2024-10-27");

    const santocchini = dataset.services.find(
      (s) =>
        /santocchini/i.test(s.location ?? "") &&
        !/spot btf/i.test(s.location ?? ""),
    );
    expect(santocchini.service_date).toBe("2025-01-05");

    const hclinic = dataset.services.find((s) =>
      /hclinic/i.test(s.location ?? ""),
    );
    expect(hclinic.service_date).toBe("2025-01-08");

    const vittoria = dataset.services.find((s) =>
      /pasticceria vittoria/i.test(s.location ?? ""),
    );
    expect(vittoria.service_date).toBe("2025-01-13");
  });

  it("marks FPR 9/25 as received using supplementary operational truth", () => {
    const dataset = buildLocalTruthDataset();

    const fpr9 = dataset.financialDocuments.find(
      (d) =>
        d.document_number === "FPR 9/25" && d.direction === "outbound",
    );
    expect(fpr9).toMatchObject({
      total_amount: 1746,
      settled_amount: 1746,
      settlement_status: "settled",
    });

    const payment = dataset.payments.find(
      (p) => p.invoice_ref === "FPR 9/25",
    );
    expect(payment).toMatchObject({
      status: "ricevuto",
      payment_date: "2026-01-26",
      projectName: "Gustare Sicilia — Nisseno",
    });
  });

  it("generates XML-derived services for invoices without CSV coverage", () => {
    const dataset = buildLocalTruthDataset();

    const nisseno = dataset.services.filter(
      (s) => s.projectName === "Gustare Sicilia — Nisseno",
    );
    expect(nisseno).toHaveLength(4);
    expect(nisseno.every((s) => s.invoice_ref === "FPR 9/25")).toBe(true);
    expect(nisseno.map((s) => s.location).sort()).toEqual([
      "Butera",
      "Mazzarino",
      "Riesi",
      "Sommatino",
    ]);
    expect(
      nisseno.every(
        (s) => s.fee_shooting === 187 && s.fee_editing === 249,
      ),
    ).toBe(true);
  });

  it("includes unfiled BTF Cantina Tre Santi episodes with pending payment", () => {
    const dataset = buildLocalTruthDataset();

    const unfiledBtf = dataset.services.filter(
      (s) =>
        s.projectName === "Bella tra i Fornelli" &&
        s.invoice_ref === null &&
        /cantina tre santi/i.test(s.location ?? ""),
    );

    expect(unfiledBtf).toHaveLength(2);
    expect(unfiledBtf.map((s) => s.service_date).sort()).toEqual([
      "2025-09-18",
      "2025-10-21",
    ]);
    expect(
      unfiledBtf.every(
        (s) => s.fee_shooting === 187 && s.fee_editing === 125,
      ),
    ).toBe(true);
    expect(
      unfiledBtf.every((s) => s.km_distance === 120),
    ).toBe(true);

    // Pending payment for the 2 unfiled episodes
    const pendingPayment = dataset.payments.find(
      (p) =>
        p.status === "in_attesa" &&
        p.projectName === "Bella tra i Fornelli",
    );
    expect(pendingPayment).toMatchObject({
      amount: 669.6,
      payment_type: "saldo",
      invoice_ref: null,
    });

    // Km expenses for the 2 unfiled episodes
    const unfiledKm = dataset.expenses.filter(
      (e) =>
        e.projectName === "Bella tra i Fornelli" &&
        e.invoice_ref === null &&
        e.expense_type === "spostamento_km" &&
        /cantina tre santi/i.test(e.description ?? ""),
    );
    expect(unfiledKm).toHaveLength(2);
  });

  it("includes unfiled Vale il Viaggio episodes with pending payment", () => {
    const dataset = buildLocalTruthDataset();

    const unfiledViv = dataset.services.filter(
      (s) =>
        s.projectName === "Vale il Viaggio" &&
        s.invoice_ref === null,
    );

    expect(unfiledViv).toHaveLength(3);
    expect(unfiledViv.map((s) => s.service_date).sort()).toEqual([
      "2026-01-29",
      "2026-02-02",
      "2026-02-22",
    ]);
    expect(
      unfiledViv.every(
        (s) => s.fee_shooting === 233 && s.fee_editing === 156,
      ),
    ).toBe(true);

    // Natale Giunta (Palermo): 0 km — car left near home
    const giunta = unfiledViv.find((s) => s.service_date === "2026-01-29");
    expect(giunta.km_distance).toBe(0);

    // Saretto Bambar + Roberto Lipari: 192 km A/R
    const withKm = unfiledViv.filter((s) => s.km_distance === 192);
    expect(withKm).toHaveLength(2);

    // Three pending payments (one per episode)
    const pendingPayments = dataset.payments.filter(
      (p) =>
        p.status === "in_attesa" &&
        p.projectName === "Vale il Viaggio",
    );
    expect(pendingPayments).toHaveLength(3);
    // Natale Giunta: 389 (0 km)
    // Saretto Bambar: 389 + 36.48 = 425.48
    // Roberto Lipari: 389 + 36.48 = 425.48
    const totalPending = pendingPayments.reduce((s, p) => s + p.amount, 0);
    expect(totalPending).toBeCloseTo(1239.96, 2);
    expect(pendingPayments.every((p) => p.invoice_ref === null)).toBe(true);

    // Km expenses only for the 2 episodes with travel
    const unfiledKm = dataset.expenses.filter(
      (e) =>
        e.projectName === "Vale il Viaggio" &&
        e.invoice_ref === null &&
        e.expense_type === "spostamento_km",
    );
    expect(unfiledKm).toHaveLength(2);
  });

  it("registers new clients from the Aruba client registry that have no XML invoices", () => {
    const dataset = buildLocalTruthDataset();
    const byName = new Map(
      dataset.clients.map((client) => [client.name.toUpperCase(), client]),
    );

    // LA TERRA ELETTRICA — only in XLS, no XML invoices
    const terra = byName.get("ASSOCIAZIONE LA TERRA ELETTRICA");
    expect(terra).toBeDefined();
    expect(terra).toMatchObject({
      fiscal_code: "91064300865",
      billing_sdi_code: "0000000",
      billing_city: "PIAZZA ARMERINA",
      billing_province: "EN",
    });

    // AMICI DELLO SPORT — only in XLS, no XML invoices
    const sport = byName.get(
      "ASSOCIAZIONE VOLONTARIATO AMICI DELLO SPORT AICS",
    );
    expect(sport).toBeDefined();
    expect(sport).toMatchObject({
      fiscal_code: "93076910848",
      billing_city: "ARAGONA",
      billing_province: "AG",
    });
  });

  it("enriches existing XML-derived clients with PEC, SDI, and email from the Aruba client registry", () => {
    const dataset = buildLocalTruthDataset();
    const byName = new Map(
      dataset.clients.map((client) => [client.name.toUpperCase(), client]),
    );

    // GUSTARE SICILIA — XML + XLS enrichment
    const gustare = byName.get("ASSOCIAZIONE CULTURALE GUSTARE SICILIA");
    expect(gustare).toMatchObject({
      billing_pec: "gustsresicilia@pec.it",
      billing_sdi_code: "KRRH6B9",
      client_type: "produzione_tv",
    });

    // TECNOSYS — XML + XLS enrichment
    const tecnosys = byName.get("TECNOSYS ITALIA S.R.L.");
    expect(tecnosys).toMatchObject({
      email: "sonia.palma@tecnosysitalia.eu",
      billing_pec: "TECNOSYSITALIASRL@LEGALMAIL.IT",
      billing_sdi_code: "KRRH6B9",
    });

    // CAMERA A SUD — XML + XLS enrichment
    const camera = byName.get("CAMERA A SUD EVENTI");
    expect(camera).toMatchObject({
      billing_sdi_code: "N92GLON",
      billing_city: "VALGUARNERA CAROPEPE",
    });
  });

  it("settles all Aruba-portal-confirmed invoices via portal cash movements", () => {
    const dataset = buildLocalTruthDataset();

    const byNumber = new Map(
      dataset.financialDocuments.map((doc) => [
        `${doc.direction}:${doc.document_number}`,
        doc,
      ]),
    );

    // Every outgoing customer_invoice present in the dataset AND in portal
    // truth must be settled (some early invoices may lack XML in the repo)
    const outboundCustomerInvoices = dataset.financialDocuments.filter(
      (doc) =>
        doc.direction === "outbound" &&
        doc.document_type === "customer_invoice",
    );

    const unsettled = outboundCustomerInvoices.filter(
      (doc) => doc.settlement_status !== "settled" && doc.open_amount > 0,
    );

    // FPA 1/23: non incassata; FPA 1/25: stornata da nota di credito FPA 2/25
    const expectedUnsettled = unsettled.map((d) => d.document_number);
    expect(expectedUnsettled).toEqual(["FPA 1/23", "FPA 1/25"]);

    // Portal cash movements should exist for non-Diego, non-supplementary invoices
    const portalCash = dataset.cashMovements.filter((cm) =>
      cm.key.startsWith("cash:portal:"),
    );
    expect(portalCash.length).toBeGreaterThan(0);

    // Each portal cash movement should have exactly one allocation
    for (const cm of portalCash) {
      const allocations = dataset.documentCashAllocations.filter(
        (a) => a.cashMovementKey === cm.key,
      );
      expect(allocations, `${cm.key} should have one allocation`).toHaveLength(1);
    }
  });

  it("excludes Edmondo Tamajo and Gioielleria Giangreco from the client registry", () => {
    const dataset = buildLocalTruthDataset();
    const names = dataset.clients.map((client) => client.name.toUpperCase());

    expect(names).not.toContain(
      expect.stringContaining("TAMAJO"),
    );
    expect(names).not.toContain(
      expect.stringContaining("GIANGRECO"),
    );
  });
});
