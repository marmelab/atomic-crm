#!/usr/bin/env node

import process from "node:process";

import { createClient } from "@supabase/supabase-js";

import { buildLocalTruthDataset } from "./local-truth-data.mjs";
import { getLocalSupabaseEnv } from "./local-admin-config.mjs";

const REQUIRED_CLIENT = "ASSOCIAZIONE CULTURALE GUSTARE SICILIA";
const REQUIRED_CONTACT = {
  first_name: "Diego",
  last_name: "Caltabiano",
};

function getMode() {
  const explicit = process.argv.find((arg) => arg.startsWith("--mode="));
  return explicit?.split("=")[1] ?? "rebuild";
}

async function localAdminClient() {
  const supabaseEnv = getLocalSupabaseEnv();

  if (!supabaseEnv.API_URL?.startsWith("http://127.0.0.1:")) {
    throw new Error(
      `Bootstrap truth rifiutato: API locale inattesa (${supabaseEnv.API_URL ?? "missing"}).`,
    );
  }

  if (!supabaseEnv.SERVICE_ROLE_KEY) {
    throw new Error(
      "SERVICE_ROLE_KEY locale non disponibile da `supabase status -o env`.",
    );
  }

  return createClient(supabaseEnv.API_URL, supabaseEnv.SERVICE_ROLE_KEY);
}

async function hasTruthDataset(adminClient) {
  const clientResponse = await adminClient
    .from("clients")
    .select("id")
    .eq("name", REQUIRED_CLIENT)
    .limit(1);

  if (clientResponse.error) {
    throw clientResponse.error;
  }

  const clientId = clientResponse.data?.[0]?.id ?? null;
  if (!clientId) return false;

  const contactResponse = await adminClient
    .from("contacts")
    .select("id")
    .eq("client_id", clientId)
    .eq("first_name", REQUIRED_CONTACT.first_name)
    .eq("last_name", REQUIRED_CONTACT.last_name)
    .limit(1);

  if (contactResponse.error) {
    throw contactResponse.error;
  }

  return Boolean(contactResponse.data?.[0]);
}

async function deleteAll(adminClient, table) {
  const response = await adminClient.from(table).delete().not("id", "is", null);
  if (response.error) {
    throw response.error;
  }
}

async function deleteAllByColumn(adminClient, table, column) {
  const response = await adminClient
    .from(table)
    .delete()
    .not(column, "is", null);
  if (response.error) {
    throw response.error;
  }
}

async function resetDomain(adminClient) {
  await deleteAll(adminClient, "financial_document_cash_allocations");
  await deleteAll(adminClient, "financial_document_project_allocations");
  await deleteAll(adminClient, "cash_movements");
  await deleteAll(adminClient, "financial_documents");
  await deleteAll(adminClient, "project_contacts");
  await deleteAll(adminClient, "contacts");
  await deleteAll(adminClient, "client_notes");
  await deleteAll(adminClient, "client_tasks");
  await deleteAll(adminClient, "services");
  await deleteAll(adminClient, "expenses");
  await deleteAll(adminClient, "payments");
  await deleteAll(adminClient, "quotes");
  await deleteAll(adminClient, "projects");
  await deleteAll(adminClient, "clients");
  await deleteAllByColumn(adminClient, "tags", "name");
}

async function insertRows(adminClient, table, rows, returning = "*") {
  if (rows.length === 0) return [];

  const response = await adminClient.from(table).insert(rows).select(returning);

  if (response.error) {
    throw response.error;
  }

  return response.data ?? [];
}

async function rebuildDomain(adminClient) {
  const dataset = buildLocalTruthDataset();

  await resetDomain(adminClient);

  const insertedClients = await insertRows(
    adminClient,
    "clients",
    dataset.clients.map(({ key: _key, ...client }) => client),
    "id, name, vat_number, fiscal_code",
  );

  const clientIdByKey = new Map();
  dataset.clients.forEach((client, index) => {
    clientIdByKey.set(client.key, insertedClients[index].id);
  });

  const insertedProjects = await insertRows(
    adminClient,
    "projects",
    dataset.projects.map((project) => ({
      client_id: clientIdByKey.get(project.clientKey),
      name: project.name,
      category: project.category,
      tv_show: project.tvShow,
      status: project.status,
      start_date: project.startDate,
      all_day: true,
      notes: makeImportNote(project.name),
    })),
    "id, name",
  );

  const projectIdByName = new Map(
    insertedProjects.map((project) => [project.name, project.id]),
  );

  const insertedContacts = await insertRows(
    adminClient,
    "contacts",
    dataset.contacts.map((contact) => ({
      client_id: clientIdByKey.get(contact.clientKey),
      first_name: contact.first_name,
      last_name: contact.last_name,
      title: contact.title,
      contact_role: contact.contact_role,
      is_primary_for_client: contact.is_primary_for_client,
      background: contact.background,
      email_jsonb: contact.email_jsonb,
      phone_jsonb: contact.phone_jsonb,
    })),
    "id, first_name, last_name",
  );

  const contactIdByDisplayName = new Map(
    insertedContacts.map((contact) => [
      `${contact.first_name} ${contact.last_name}`,
      contact.id,
    ]),
  );

  await insertRows(
    adminClient,
    "project_contacts",
    dataset.projectContacts.map((row) => ({
      project_id: projectIdByName.get(row.projectName),
      contact_id: contactIdByDisplayName.get(row.contactDisplayName),
      is_primary: row.is_primary,
    })),
  );

  await insertRows(
    adminClient,
    "services",
    dataset.services.map((service) => ({
      project_id: projectIdByName.get(service.projectName),
      service_date: service.service_date,
      service_end: service.service_end,
      all_day: service.all_day,
      service_type: service.service_type,
      fee_shooting: service.fee_shooting,
      fee_editing: service.fee_editing,
      fee_other: service.fee_other,
      km_distance: service.km_distance,
      km_rate: service.km_rate,
      location: service.location,
      invoice_ref: service.invoice_ref,
      notes: service.notes,
    })),
  );

  await insertRows(
    adminClient,
    "payments",
    dataset.payments.map((payment) => ({
      client_id: clientIdByKey.get(payment.clientKey),
      project_id: payment.projectName
        ? projectIdByName.get(payment.projectName)
        : null,
      payment_date: payment.payment_date,
      payment_type: payment.payment_type,
      amount: payment.amount,
      method: payment.method,
      invoice_ref: payment.invoice_ref,
      status: payment.status,
      notes: payment.notes,
    })),
  );

  await insertRows(
    adminClient,
    "expenses",
    dataset.expenses.map((expense) => ({
      client_id: clientIdByKey.get(expense.clientKey),
      project_id: expense.projectName
        ? projectIdByName.get(expense.projectName)
        : null,
      expense_date: expense.expense_date,
      expense_type: expense.expense_type,
      km_distance: expense.km_distance,
      km_rate: expense.km_rate,
      amount: expense.amount,
      markup_percent: expense.markup_percent,
      description: expense.description,
      invoice_ref: expense.invoice_ref,
    })),
  );

  const insertedFinancialDocuments = await insertRows(
    adminClient,
    "financial_documents",
    dataset.financialDocuments.map((document) => ({
      client_id: clientIdByKey.get(document.clientKey),
      direction: document.direction,
      xml_document_code: document.xml_document_code,
      document_type: document.document_type,
      related_document_number: document.related_document_number,
      document_number: document.document_number,
      issue_date: document.issue_date,
      due_date: document.due_date,
      total_amount: document.total_amount,
      taxable_amount: document.taxable_amount,
      tax_amount: document.tax_amount,
      stamp_amount: document.stamp_amount,
      source_path: document.source_path,
      notes: document.notes,
    })),
    "id, client_id, direction, document_number, issue_date",
  );

  const documentIdByKey = new Map();
  dataset.financialDocuments.forEach((document, index) => {
    documentIdByKey.set(document.key, insertedFinancialDocuments[index].id);
  });

  const insertedCashMovements = await insertRows(
    adminClient,
    "cash_movements",
    dataset.cashMovements.map((movement) => ({
      client_id: movement.clientKey
        ? clientIdByKey.get(movement.clientKey)
        : null,
      project_id: movement.projectName
        ? projectIdByName.get(movement.projectName)
        : null,
      direction: movement.direction,
      movement_date: movement.movement_date,
      amount: movement.amount,
      method: movement.method,
      reference: movement.reference,
      source_path: movement.source_path,
      notes: movement.notes,
    })),
    "id, movement_date, amount, reference",
  );

  const cashMovementIdByKey = new Map();
  dataset.cashMovements.forEach((movement, index) => {
    cashMovementIdByKey.set(movement.key, insertedCashMovements[index].id);
  });

  const documentKeyByNumber = new Map(
    dataset.financialDocuments.map((document) => [
      document.document_number,
      document.key,
    ]),
  );

  await insertRows(
    adminClient,
    "financial_document_project_allocations",
    dataset.documentProjectAllocations.map((allocation) => ({
      document_id: documentIdByKey.get(
        documentKeyByNumber.get(allocation.documentNumber),
      ),
      project_id: allocation.projectName
        ? projectIdByName.get(allocation.projectName)
        : null,
      allocation_amount: allocation.allocation_amount,
      notes: allocation.notes,
    })),
  );

  await insertRows(
    adminClient,
    "financial_document_cash_allocations",
    dataset.documentCashAllocations.map((allocation) => ({
      document_id: documentIdByKey.get(
        documentKeyByNumber.get(allocation.documentNumber),
      ),
      cash_movement_id: cashMovementIdByKey.get(allocation.cashMovementKey),
      project_id: allocation.projectName
        ? projectIdByName.get(allocation.projectName)
        : null,
      allocation_amount: allocation.allocation_amount,
      notes: allocation.notes,
    })),
  );

  return dataset;
}

function makeImportNote(projectName) {
  return `Rebuild locale da fonti reali Fatture/ per progetto ${projectName}.`;
}

async function main() {
  const adminClient = await localAdminClient();
  const mode = getMode();

  if (mode === "ensure") {
    const exists = await hasTruthDataset(adminClient);
    if (exists) {
      console.log(
        JSON.stringify(
          {
            mode,
            status: "skipped",
            reason: "truth_dataset_present",
          },
          null,
          2,
        ),
      );
      return;
    }
  }

  const dataset = await rebuildDomain(adminClient);
  console.log(
    JSON.stringify(
      {
        mode,
        status: "rebuilt",
        inventory: dataset.inventory,
        counts: {
          clients: dataset.clients.length,
          projects: dataset.projects.length,
          contacts: dataset.contacts.length,
          projectContacts: dataset.projectContacts.length,
          services: dataset.services.length,
          financialDocuments: dataset.financialDocuments.length,
          cashMovements: dataset.cashMovements.length,
          documentProjectAllocations: dataset.documentProjectAllocations.length,
          documentCashAllocations: dataset.documentCashAllocations.length,
          payments: dataset.payments.length,
          expenses: dataset.expenses.length,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : JSON.stringify(error, null, 2),
  );
  process.exit(1);
});
