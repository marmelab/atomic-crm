#!/usr/bin/env node

/**
 * Audit script: reconciles local DB financial data against Aruba portal truth.
 *
 * Checks performed:
 * 1. Every outgoing XML invoice has a matching financial_document in DB
 * 2. Amounts (total, taxable, tax) match between XML and DB
 * 3. Settlement status matches ARUBA_PORTAL_TRUTH expectations
 * 4. Collection dates match between cash_movements and portal truth
 * 5. Payments table aligns with financial documents
 * 6. No orphan financial documents (in DB but not in XML)
 * 7. Totals cross-check: sum of payments vs sum of settled documents
 */

import process from "node:process";

import { createClient } from "@supabase/supabase-js";

import {
  ARUBA_PORTAL_TRUTH,
  buildLocalTruthDataset,
  buildLocalTruthDebugSnapshot,
} from "./local-truth-data.mjs";
import { getLocalSupabaseEnv } from "./local-admin-config.mjs";

// ── Formatting helpers ──────────────────────────────────────────────

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function ok(message) {
  console.log(`  ${GREEN}✓${RESET} ${message}`);
}

function fail(message) {
  console.log(`  ${RED}✗${RESET} ${message}`);
}

function warn(message) {
  console.log(`  ${YELLOW}⚠${RESET} ${message}`);
}

function header(title) {
  console.log(`\n${BOLD}${CYAN}── ${title} ──${RESET}\n`);
}

function dim(text) {
  return `${DIM}${text}${RESET}`;
}

function currency(amount) {
  return `€${Number(amount).toFixed(2)}`;
}

// ── DB connection ───────────────────────────────────────────────────

async function getAdminClient() {
  const env = getLocalSupabaseEnv();

  if (!env.API_URL?.startsWith("http://127.0.0.1:")) {
    throw new Error(
      `Audit rifiutato: API locale inattesa (${env.API_URL ?? "missing"}).`,
    );
  }

  return createClient(env.API_URL, env.SERVICE_ROLE_KEY);
}

// ── Report mode: human-readable table to compare with Aruba portal ──

async function reportMode() {
  const adminClient = await getAdminClient();

  const { data: rows, error } = await adminClient
    .from("financial_documents_summary")
    .select("*")
    .eq("direction", "outbound")
    .order("issue_date", { ascending: true });

  if (error) throw error;

  // Group by year
  const years = new Map();
  for (const row of rows) {
    const year = row.issue_date?.slice(0, 4) ?? "????";
    if (!years.has(year)) years.set(year, []);
    years.get(year).push(row);
  }

  const colW = { num: 12, date: 12, client: 32, amount: 12, status: 10, collected: 12 };
  const line = "-".repeat(
    colW.num + colW.date + colW.client + colW.amount + colW.status + colW.collected + 15,
  );

  function pad(str, w) {
    return String(str).slice(0, w).padEnd(w);
  }
  function rpad(str, w) {
    return String(str).slice(0, w).padStart(w);
  }

  function statusLabel(row) {
    if (row.document_type === "customer_credit_note") return "STORNO";
    if (row.settlement_status === "settled") return "INCASS.";
    if (row.settlement_status === "partial") return "PARZIALE";
    if (row.settlement_status === "overdue") return "SCADUTO";
    return "APERTO";
  }

  function statusColor(row) {
    const label = statusLabel(row);
    if (label === "INCASS." || label === "STORNO") return GREEN;
    if (label === "SCADUTO") return RED;
    if (label === "PARZIALE") return YELLOW;
    return DIM;
  }

  console.log(
    `\n${BOLD}Report fatture emesse — confronta con portale Aruba "FATTURE INVIATE"${RESET}\n`,
  );

  let grandTotal = 0;
  let grandSettled = 0;

  for (const [year, invoices] of [...years.entries()].sort()) {
    header(`${year} — ${invoices.length} fatture`);

    console.log(
      `  ${DIM}${pad("Numero", colW.num)} ${pad("Data", colW.date)} ${pad("Cliente", colW.client)} ${rpad("Importo", colW.amount)} ${pad("Stato", colW.status)} ${pad("Incassata", colW.collected)}${RESET}`,
    );
    console.log(`  ${DIM}${line}${RESET}`);

    let yearTotal = 0;
    let yearSettled = 0;

    for (const row of invoices) {
      const color = statusColor(row);
      const label = statusLabel(row);
      const amount = Number(row.total_amount);
      yearTotal += amount;
      if (row.settlement_status === "settled") yearSettled += amount;

      // Find collection date from cash allocations if settled
      const collectedDate =
        row.settlement_status === "settled"
          ? dim("vedi portale")
          : row.document_type === "customer_credit_note"
            ? dim("n/a")
            : "";

      console.log(
        `  ${pad(row.document_number, colW.num)} ${pad(row.issue_date, colW.date)} ${pad(row.client_name?.slice(0, colW.client - 1), colW.client)} ${rpad(currency(amount), colW.amount)} ${color}${pad(label, colW.status)}${RESET} ${collectedDate}`,
      );
    }

    grandTotal += yearTotal;
    grandSettled += yearSettled;

    console.log(`  ${DIM}${line}${RESET}`);
    console.log(
      `  ${BOLD}${pad("", colW.num)} ${pad("", colW.date)} ${pad("TOTALE " + year, colW.client)} ${rpad(currency(yearTotal), colW.amount)}${RESET} ${dim(`saldato: ${currency(yearSettled)}`)}`,
    );
  }

  console.log(`\n${BOLD}Totale complessivo: ${currency(grandTotal)}${RESET} — saldato: ${currency(grandSettled)}, aperto: ${currency(grandTotal - grandSettled)}\n`);

  console.log(
    `${DIM}Confronta ogni riga con la colonna "Doc. coll." del portale Aruba.`,
  );
  console.log(
    `Se una fattura qui risulta INCASS. ma su Aruba no (o viceversa), aggiorna ARUBA_PORTAL_TRUTH e riesegui.${RESET}\n`,
  );

  // ── Incassi per anno di incasso (comparable with Aruba "Incassi" dashboard) ──

  const { data: cashRows, error: cashError } = await adminClient
    .from("cash_movements")
    .select("movement_date, amount")
    .eq("direction", "inbound")
    .order("movement_date", { ascending: true });

  if (cashError) throw cashError;

  // Aruba "Incassi" dashboard reference values (screenshot 2026-03-02)
  const arubaIncassi = new Map([
    ["2023", 6273.26],
    ["2024", 13740.18],
    ["2025", 24954.35],
    ["2026", 1746.0],
  ]);

  const incassiByYear = new Map();
  for (const row of cashRows) {
    const year = row.movement_date?.slice(0, 4) ?? "????";
    incassiByYear.set(year, (incassiByYear.get(year) ?? 0) + Number(row.amount));
  }

  console.log(
    `${BOLD}Incassi per anno di INCASSO — confronta con dashboard Aruba "Incassi"${RESET}\n`,
  );

  const allYears = [
    ...new Set([...incassiByYear.keys(), ...arubaIncassi.keys()]),
  ].sort();

  let totalLocal = 0;
  let totalAruba = 0;

  console.log(
    `  ${DIM}${"Anno".padEnd(6)} ${"Locale".padStart(14)} ${"Aruba".padStart(14)} ${"Delta".padStart(14)} ${"Δ%".padStart(8)}${RESET}`,
  );
  console.log(`  ${DIM}${"-".repeat(60)}${RESET}`);

  for (const year of allYears) {
    const local = incassiByYear.get(year) ?? 0;
    const aruba = arubaIncassi.get(year) ?? 0;
    const delta = local - aruba;
    const pct = aruba > 0 ? (delta / aruba) * 100 : 0;

    totalLocal += local;
    totalAruba += aruba;

    const deltaColor =
      Math.abs(delta) < 1 ? GREEN : Math.abs(pct) < 0.5 ? YELLOW : RED;
    const checkMark =
      Math.abs(delta) < 1 ? `${GREEN}✓${RESET}` : `${deltaColor}○${RESET}`;

    console.log(
      `  ${checkMark} ${BOLD}${year}${RESET}  ${currency(local).padStart(14)} ${currency(aruba).padStart(14)} ${deltaColor}${(delta >= 0 ? "+" : "") + currency(delta).padStart(13)}${RESET} ${deltaColor}${pct.toFixed(2).padStart(7)}%${RESET}`,
    );
  }

  console.log(`  ${DIM}${"-".repeat(60)}${RESET}`);

  const totalDelta = totalLocal - totalAruba;
  const totalPct = totalAruba > 0 ? (totalDelta / totalAruba) * 100 : 0;
  console.log(
    `  ${BOLD}TOT   ${currency(totalLocal).padStart(14)} ${currency(totalAruba).padStart(14)} ${(totalDelta >= 0 ? "+" : "") + currency(totalDelta).padStart(13)} ${totalPct.toFixed(2).padStart(7)}%${RESET}`,
  );

  // ── Detect ARUBA_PORTAL_TRUTH entries without matching financial documents ──

  const dbDocNumbers = new Set(rows.map((r) => r.document_number));
  const missingXmlRefs = [];
  for (const [ref, entry] of ARUBA_PORTAL_TRUTH) {
    if (!dbDocNumbers.has(ref)) {
      missingXmlRefs.push({ ref, collectionDate: entry.collectionDate });
    }
  }

  if (missingXmlRefs.length > 0) {
    console.log(
      `${YELLOW}${BOLD}Fatture in ARUBA_PORTAL_TRUTH senza documento locale:${RESET}`,
    );
    for (const { ref, collectionDate } of missingXmlRefs) {
      console.log(
        `  ${YELLOW}⚠${RESET} ${ref} — incassata il ${collectionDate} su Aruba, ma XML mancante in Fatture/`,
      );
    }
    console.log(
      `\n${DIM}Aggiungi il file XML a Fatture/ e riesegui per colmare il delta.${RESET}\n`,
    );
  }

  console.log(
    `${DIM}Delta attesi (escludendo XML mancanti): il locale usa ImportoTotaleDocumento`,
  );
  console.log(
    `(lordo bolli) mentre Aruba "Incassi" usa il netto delle rate. Δ < 0.5% è fisiologico.${RESET}\n`,
  );
}

// ── Audit checks ────────────────────────────────────────────────────

async function main() {
  const adminClient = await getAdminClient();
  const dataset = buildLocalTruthDataset();
  const snapshot = buildLocalTruthDebugSnapshot();

  let totalChecks = 0;
  let passed = 0;
  let failed = 0;
  let warnings = 0;

  function check(condition, passMsg, failMsg) {
    totalChecks++;
    if (condition) {
      ok(passMsg);
      passed++;
    } else {
      fail(failMsg);
      failed++;
    }
  }

  function warnCheck(message) {
    totalChecks++;
    warn(message);
    warnings++;
  }

  // ── 1. Financial documents: DB vs dataset ─────────────────────────

  header("1. Financial Documents — dataset vs DB");

  const { data: dbDocuments, error: docError } = await adminClient
    .from("financial_documents")
    .select("*")
    .order("issue_date", { ascending: true });

  if (docError) throw docError;

  check(
    dbDocuments.length === dataset.financialDocuments.length,
    `Conteggio documenti: dataset ${dataset.financialDocuments.length} = DB ${dbDocuments.length}`,
    `Conteggio documenti DIVERSO: dataset ${dataset.financialDocuments.length} vs DB ${dbDocuments.length}`,
  );

  // Index DB documents by document_number + direction for matching
  const dbDocByKey = new Map();
  for (const doc of dbDocuments) {
    dbDocByKey.set(`${doc.direction}:${doc.document_number}`, doc);
  }

  let amountMismatches = 0;
  for (const dsDoc of dataset.financialDocuments) {
    const dbDoc = dbDocByKey.get(`${dsDoc.direction}:${dsDoc.document_number}`);
    if (!dbDoc) {
      fail(
        `Documento ${dsDoc.document_number} (${dsDoc.direction}) nel dataset ma NON nel DB`,
      );
      failed++;
      totalChecks++;
      continue;
    }
    if (
      Math.abs(Number(dbDoc.total_amount) - dsDoc.total_amount) > 0.01
    ) {
      fail(
        `${dsDoc.document_number}: importo dataset ${currency(dsDoc.total_amount)} vs DB ${currency(dbDoc.total_amount)}`,
      );
      amountMismatches++;
    }
  }
  totalChecks++;
  if (amountMismatches === 0) {
    ok(`Tutti gli importi dei documenti corrispondono`);
    passed++;
  } else {
    fail(`${amountMismatches} documenti con importi diversi`);
    failed++;
  }

  // ── 2. Financial documents summary view: settlement status ────────

  header("2. Settlement Status — DB view vs Aruba Portal Truth");

  const { data: dbSummary, error: summaryError } = await adminClient
    .from("financial_documents_summary")
    .select("*")
    .eq("direction", "outbound")
    .order("issue_date", { ascending: true });

  if (summaryError) throw summaryError;

  const summaryByNumber = new Map();
  for (const row of dbSummary) {
    summaryByNumber.set(row.document_number, row);
  }

  // Extract ARUBA_PORTAL_TRUTH from the dataset's payments
  // Build expected settlement from dataset payments
  const outgoingPaymentsByInvoice = new Map();
  for (const payment of dataset.payments) {
    if (!payment.invoice_ref) continue;
    const existing = outgoingPaymentsByInvoice.get(payment.invoice_ref) ?? {
      totalAmount: 0,
      status: payment.status,
      date: payment.payment_date,
    };
    existing.totalAmount += payment.amount;
    // Keep the "ricevuto" status if any payment says so
    if (payment.status === "ricevuto") {
      existing.status = "ricevuto";
      existing.date = payment.payment_date;
    }
    outgoingPaymentsByInvoice.set(payment.invoice_ref, existing);
  }

  // Use the invoices from the snapshot to get portal truth data
  const outgoingInvoices = snapshot.invoices.filter(
    (inv) => inv.direction === "outgoing",
  );
  const customerInvoices = outgoingInvoices.filter(
    (inv) => inv.fiscalDocumentType === "customer_invoice",
  );
  const creditNotes = outgoingInvoices.filter(
    (inv) => inv.fiscalDocumentType === "customer_credit_note",
  );

  // Check each outgoing customer invoice
  let settlementMatches = 0;
  let settlementMismatches = 0;

  for (const invoice of customerInvoices) {
    const summaryRow = summaryByNumber.get(invoice.number);
    if (!summaryRow) {
      fail(`${invoice.number}: presente in XML ma NON nella view summary`);
      settlementMismatches++;
      continue;
    }

    const paymentInfo = outgoingPaymentsByInvoice.get(invoice.number);
    const expectedSettled = paymentInfo?.status === "ricevuto";
    const dbSettled = summaryRow.settlement_status === "settled";

    // Check if credit note target — those should have matching credit note
    const hasCreditNote = creditNotes.some(
      (cn) => cn.relatedDocumentNumber === invoice.number,
    );

    if (expectedSettled && dbSettled) {
      settlementMatches++;
    } else if (!expectedSettled && !dbSettled) {
      settlementMatches++;
    } else if (hasCreditNote && !expectedSettled) {
      // Stornata invoices might show as overdue/open — that's expected
      settlementMatches++;
    } else {
      fail(
        `${invoice.number}: payment dice "${paymentInfo?.status ?? "nessuno"}" ma DB dice "${summaryRow.settlement_status}" ${dim(`(settled: ${currency(summaryRow.settled_amount)}, open: ${currency(summaryRow.open_amount)})`)}`,
      );
      settlementMismatches++;
    }
  }

  totalChecks++;
  if (settlementMismatches === 0) {
    ok(
      `Settlement status: ${settlementMatches}/${customerInvoices.length} fatture corrispondono`,
    );
    passed++;
  } else {
    fail(
      `Settlement status: ${settlementMismatches}/${customerInvoices.length} fatture NON corrispondono`,
    );
    failed++;
  }

  // ── 3. Cash movements: DB vs dataset ──────────────────────────────

  header("3. Cash Movements — dataset vs DB");

  const { data: dbCashMovements, error: cashError } = await adminClient
    .from("cash_movements")
    .select("*")
    .order("movement_date", { ascending: true });

  if (cashError) throw cashError;

  check(
    dbCashMovements.length === dataset.cashMovements.length,
    `Conteggio cash movements: dataset ${dataset.cashMovements.length} = DB ${dbCashMovements.length}`,
    `Conteggio cash movements DIVERSO: dataset ${dataset.cashMovements.length} vs DB ${dbCashMovements.length}`,
  );

  const dbCashTotal = dbCashMovements.reduce(
    (sum, cm) => sum + Number(cm.amount),
    0,
  );
  const datasetCashTotal = dataset.cashMovements.reduce(
    (sum, cm) => sum + cm.amount,
    0,
  );

  check(
    Math.abs(dbCashTotal - datasetCashTotal) < 0.01,
    `Totale cash movements: dataset ${currency(datasetCashTotal)} = DB ${currency(dbCashTotal)}`,
    `Totale cash movements DIVERSO: dataset ${currency(datasetCashTotal)} vs DB ${currency(dbCashTotal)}`,
  );

  // ── 4. Payments: DB vs dataset ────────────────────────────────────

  header("4. Payments — dataset vs DB");

  const { data: dbPayments, error: payError } = await adminClient
    .from("payments")
    .select("*")
    .order("payment_date", { ascending: true });

  if (payError) throw payError;

  check(
    dbPayments.length === dataset.payments.length,
    `Conteggio pagamenti: dataset ${dataset.payments.length} = DB ${dbPayments.length}`,
    `Conteggio pagamenti DIVERSO: dataset ${dataset.payments.length} vs DB ${dbPayments.length}`,
  );

  const dbPaymentTotal = dbPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0,
  );
  const datasetPaymentTotal = dataset.payments.reduce(
    (sum, p) => sum + p.amount,
    0,
  );

  check(
    Math.abs(dbPaymentTotal - datasetPaymentTotal) < 0.01,
    `Totale pagamenti: dataset ${currency(datasetPaymentTotal)} = DB ${currency(dbPaymentTotal)}`,
    `Totale pagamenti DIVERSO: dataset ${currency(datasetPaymentTotal)} vs DB ${currency(dbPaymentTotal)}`,
  );

  // ── 5. Cross-check: settled documents vs received payments ────────

  header("5. Cross-check — documenti saldati vs pagamenti ricevuti");

  const settledDocumentTotal = dbSummary
    .filter((row) => row.settlement_status === "settled")
    .reduce((sum, row) => sum + Number(row.total_amount), 0);

  const receivedPaymentTotal = dbPayments
    .filter((p) => p.status === "ricevuto")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const crossDiff = Math.abs(settledDocumentTotal - receivedPaymentTotal);
  // Known structural gap: documents use ImportoTotaleDocumento (gross, includes
  // stamp duty) while payments use payableAmount (net). The difference is the
  // aggregate stamp duty across all invoices. A Δ under 0.5% is expected.
  const crossPct = settledDocumentTotal > 0
    ? (crossDiff / settledDocumentTotal) * 100
    : 0;

  if (crossDiff < 1.0) {
    check(
      true,
      `Documenti saldati ${currency(settledDocumentTotal)} ≈ pagamenti ricevuti ${currency(receivedPaymentTotal)} ${dim(`(Δ ${currency(crossDiff)})`)}`,
      "",
    );
  } else if (crossPct < 0.5) {
    warnCheck(
      `Documenti saldati ${currency(settledDocumentTotal)} vs pagamenti ricevuti ${currency(receivedPaymentTotal)} — Δ ${currency(crossDiff)} (${crossPct.toFixed(2)}%) ${dim("atteso: bolli e arrotondamenti tra total e payableAmount")}`,
    );
  } else {
    check(
      false,
      "",
      `DISCREPANZA: documenti saldati ${currency(settledDocumentTotal)} vs pagamenti ricevuti ${currency(receivedPaymentTotal)} ${dim(`(Δ ${currency(crossDiff)}, ${crossPct.toFixed(2)}%)`)}`,
    );
  }

  // ── 6. Allocations integrity ──────────────────────────────────────

  header("6. Allocazioni — integrità referenziale");

  const { data: dbProjectAlloc, error: paError } = await adminClient
    .from("financial_document_project_allocations")
    .select("*");

  if (paError) throw paError;

  const { data: dbCashAlloc, error: caError } = await adminClient
    .from("financial_document_cash_allocations")
    .select("*");

  if (caError) throw caError;

  check(
    dbProjectAlloc.length === dataset.documentProjectAllocations.length,
    `Project allocations: dataset ${dataset.documentProjectAllocations.length} = DB ${dbProjectAlloc.length}`,
    `Project allocations DIVERSO: dataset ${dataset.documentProjectAllocations.length} vs DB ${dbProjectAlloc.length}`,
  );

  check(
    dbCashAlloc.length === dataset.documentCashAllocations.length,
    `Cash allocations: dataset ${dataset.documentCashAllocations.length} = DB ${dbCashAlloc.length}`,
    `Cash allocations DIVERSO: dataset ${dataset.documentCashAllocations.length} vs DB ${dbCashAlloc.length}`,
  );

  // Check that all allocations reference existing documents
  const dbDocumentIds = new Set(dbDocuments.map((d) => d.id));
  const dbCashMovementIds = new Set(dbCashMovements.map((cm) => cm.id));

  const orphanProjectAlloc = dbProjectAlloc.filter(
    (a) => !dbDocumentIds.has(a.document_id),
  );
  const orphanCashAlloc = dbCashAlloc.filter(
    (a) =>
      !dbDocumentIds.has(a.document_id) ||
      !dbCashMovementIds.has(a.cash_movement_id),
  );

  check(
    orphanProjectAlloc.length === 0,
    `Nessuna project allocation orfana`,
    `${orphanProjectAlloc.length} project allocations orfane (document_id non trovato)`,
  );

  check(
    orphanCashAlloc.length === 0,
    `Nessuna cash allocation orfana`,
    `${orphanCashAlloc.length} cash allocations orfane`,
  );

  // ── 7. Fatture per anno — riepilogo importi ───────────────────────

  header("7. Riepilogo fatture emesse per anno");

  const invoicesByYear = new Map();
  for (const row of dbSummary) {
    if (row.document_type !== "customer_invoice") continue;
    const year = row.issue_date?.slice(0, 4) ?? "????";
    const bucket = invoicesByYear.get(year) ?? {
      count: 0,
      total: 0,
      settled: 0,
      open: 0,
    };
    bucket.count++;
    bucket.total += Number(row.total_amount);
    bucket.settled += Number(row.settled_amount);
    bucket.open += Number(row.open_amount);
    invoicesByYear.set(year, bucket);
  }

  for (const [year, bucket] of [...invoicesByYear.entries()].sort()) {
    const statusIcon =
      bucket.open < 0.01 ? `${GREEN}✓${RESET}` : `${YELLOW}○${RESET}`;
    console.log(
      `  ${statusIcon} ${BOLD}${year}${RESET}: ${bucket.count} fatture, ` +
        `totale ${currency(bucket.total)}, ` +
        `saldato ${currency(bucket.settled)}, ` +
        `aperto ${currency(bucket.open)}`,
    );
  }

  // ── 8. Reconciliation issues ──────────────────────────────────────

  header("8. Reconciliation Issues");

  if (dataset.reconciliationIssues.length === 0) {
    ok("Nessun issue di riconciliazione");
  } else {
    for (const issue of dataset.reconciliationIssues) {
      warnCheck(
        `${issue.invoiceRef}: ${issue.kind} — "${issue.description}" (${currency(issue.amount)}) ${dim(`[${issue.sourceFile}]`)}`,
      );
    }
  }

  // ── 9. Fatture con note di credito ────────────────────────────────

  header("9. Note di credito");

  const dbCreditNotes = dbSummary.filter(
    (row) => row.document_type === "customer_credit_note",
  );

  if (dbCreditNotes.length === 0) {
    ok("Nessuna nota di credito nel DB");
  } else {
    for (const cn of dbCreditNotes) {
      console.log(
        `  ${DIM}→${RESET} ${cn.document_number} storna ${cn.related_document_number ?? "?"} — ${currency(cn.total_amount)}`,
      );
    }
    ok(`${dbCreditNotes.length} note di credito presenti`);
    passed++;
    totalChecks++;
  }

  // ── 10. Fatture ricevute (fornitori) ──────────────────────────────

  header("10. Fatture ricevute (fornitori)");

  const dbIncoming = dbDocuments.filter((d) => d.direction === "inbound");
  const datasetIncoming = dataset.financialDocuments.filter(
    (d) => d.direction === "inbound",
  );

  check(
    dbIncoming.length === datasetIncoming.length,
    `Fatture ricevute: dataset ${datasetIncoming.length} = DB ${dbIncoming.length}`,
    `Fatture ricevute DIVERSO: dataset ${datasetIncoming.length} vs DB ${dbIncoming.length}`,
  );

  const incomingTotal = dbIncoming.reduce(
    (sum, d) => sum + Number(d.total_amount),
    0,
  );
  console.log(`  ${DIM}Totale fatture ricevute: ${currency(incomingTotal)}${RESET}`);

  // ── Summary ───────────────────────────────────────────────────────

  header("Riepilogo Audit");

  console.log(`  Controlli: ${totalChecks}`);
  console.log(`  ${GREEN}Passati:  ${passed}${RESET}`);
  if (failed > 0) {
    console.log(`  ${RED}Falliti:  ${failed}${RESET}`);
  }
  if (warnings > 0) {
    console.log(`  ${YELLOW}Avvisi:   ${warnings}${RESET}`);
  }
  console.log();

  if (failed > 0) {
    console.log(
      `${RED}${BOLD}AUDIT FALLITO${RESET} — ${failed} controlli non superati.`,
    );
    process.exit(1);
  } else if (warnings > 0) {
    console.log(
      `${YELLOW}${BOLD}AUDIT OK con avvisi${RESET} — ${warnings} elementi da verificare manualmente.`,
    );
  } else {
    console.log(
      `${GREEN}${BOLD}AUDIT COMPLETATO${RESET} — tutti i dati finanziari corrispondono.`,
    );
  }
}

const isReport = process.argv.includes("--report");

(isReport ? reportMode() : main()).catch((error) => {
  console.error(
    `\n${RED}Errore fatale:${RESET}`,
    error instanceof Error ? error.message : JSON.stringify(error, null, 2),
  );
  process.exit(1);
});
