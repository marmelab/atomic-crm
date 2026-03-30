import type { Client } from "../types";
import type { InvoiceImportRecordDraft } from "@/lib/ai/invoiceImport";

const setOptional = (
  searchParams: URLSearchParams,
  key: string,
  value?: string | null,
) => {
  const normalized = value?.trim();
  if (normalized) {
    searchParams.set(key, normalized);
  }
};

const normalizeComparable = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed
    ? trimmed.replace(/\s+/g, " ").toLocaleLowerCase("it-IT")
    : null;
};

export const buildClientCreatePathFromInvoiceDraft = ({
  record,
}: {
  record: Pick<
    InvoiceImportRecordDraft,
    | "counterpartyName"
    | "billingName"
    | "vatNumber"
    | "fiscalCode"
    | "billingAddressStreet"
    | "billingAddressNumber"
    | "billingPostalCode"
    | "billingCity"
    | "billingProvince"
    | "billingCountry"
    | "billingSdiCode"
    | "billingPec"
  >;
}) => {
  const searchParams = new URLSearchParams();
  const billingName =
    record.billingName?.trim() || record.counterpartyName?.trim() || "";
  const displayName = billingName || record.counterpartyName?.trim() || "";
  const comparableCounterparty = normalizeComparable(record.counterpartyName);
  const comparableBillingName = normalizeComparable(record.billingName);
  const hasDistinctCounterpartyAndBillingName =
    comparableCounterparty != null &&
    comparableBillingName != null &&
    comparableCounterparty !== comparableBillingName;

  setOptional(searchParams, "name", displayName);
  setOptional(searchParams, "billing_name", billingName);
  setOptional(searchParams, "vat_number", record.vatNumber);
  setOptional(searchParams, "fiscal_code", record.fiscalCode);
  setOptional(
    searchParams,
    "billing_address_street",
    record.billingAddressStreet,
  );
  setOptional(
    searchParams,
    "billing_address_number",
    record.billingAddressNumber,
  );
  setOptional(searchParams, "billing_postal_code", record.billingPostalCode);
  setOptional(searchParams, "billing_city", record.billingCity);
  setOptional(searchParams, "billing_province", record.billingProvince);
  setOptional(searchParams, "billing_country", record.billingCountry);
  setOptional(searchParams, "billing_sdi_code", record.billingSdiCode);
  setOptional(searchParams, "billing_pec", record.billingPec);
  setOptional(
    searchParams,
    "notes",
    hasDistinctCounterpartyAndBillingName
      ? `Referente operativo indicato nel documento: ${record.counterpartyName?.trim()}`
      : null,
  );
  searchParams.set("launcher_source", "invoice_import");
  searchParams.set("launcher_action", "client_create_from_invoice");

  const search = searchParams.toString();
  return search ? `/clients/create?${search}` : "/clients/create";
};

export const getClientCreateDefaultsFromSearch = (
  search: string,
): Partial<Client> => {
  const searchParams = new URLSearchParams(search);
  const getOptional = (key: string) => {
    const value = searchParams.get(key)?.trim();
    return value ? value : undefined;
  };

  return {
    name: getOptional("name") ?? "",
    billing_name: getOptional("billing_name"),
    vat_number: getOptional("vat_number"),
    fiscal_code: getOptional("fiscal_code"),
    billing_address_street: getOptional("billing_address_street"),
    billing_address_number: getOptional("billing_address_number"),
    billing_postal_code: getOptional("billing_postal_code"),
    billing_city: getOptional("billing_city"),
    billing_province: getOptional("billing_province"),
    billing_country: getOptional("billing_country"),
    billing_sdi_code: getOptional("billing_sdi_code"),
    billing_pec: getOptional("billing_pec"),
    notes: getOptional("notes"),
    tags: [],
  };
};

export const getClientCreateLauncherContextFromSearch = (search: string) => {
  const searchParams = new URLSearchParams(search);
  const source = searchParams.get("launcher_source");
  const action = searchParams.get("launcher_action");

  if (source !== "invoice_import" || action !== "client_create_from_invoice") {
    return null;
  }

  return { source, action };
};
