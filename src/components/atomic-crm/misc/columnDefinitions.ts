export type ColumnDef = {
  key: string;
  label: string;
  exportKey?: string;
};

export const PAYMENT_COLUMNS: ColumnDef[] = [
  { key: "date", label: "Data", exportKey: "data" },
  { key: "client", label: "Cliente", exportKey: "cliente" },
  { key: "project", label: "Progetto", exportKey: "progetto" },
  { key: "quote", label: "Preventivo" },
  { key: "type", label: "Tipo", exportKey: "tipo" },
  { key: "amount", label: "Importo", exportKey: "importo" },
  { key: "invoice_ref", label: "Rif. Fattura", exportKey: "rif_fattura" },
  { key: "status", label: "Stato", exportKey: "stato" },
];

export const EXPENSE_COLUMNS: ColumnDef[] = [
  { key: "date", label: "Data", exportKey: "data" },
  { key: "type", label: "Tipo", exportKey: "tipo" },
  { key: "client", label: "Cliente", exportKey: "cliente" },
  { key: "supplier", label: "Fornitore", exportKey: "fornitore" },
  { key: "project", label: "Progetto", exportKey: "progetto" },
  { key: "km", label: "Km", exportKey: "km" },
  { key: "total", label: "Totale", exportKey: "totale" },
  { key: "description", label: "Descrizione", exportKey: "descrizione" },
];

export const SERVICE_COLUMNS: ColumnDef[] = [
  { key: "date", label: "Data", exportKey: "data_inizio" },
  { key: "client", label: "Cliente", exportKey: "cliente" },
  { key: "project", label: "Progetto", exportKey: "progetto" },
  { key: "type", label: "Tipo", exportKey: "tipo" },
  { key: "description", label: "Descrizione", exportKey: "descrizione" },
  { key: "fee_shooting", label: "Riprese", exportKey: "riprese" },
  { key: "fee_editing", label: "Montaggio", exportKey: "montaggio" },
  { key: "fee_other", label: "Altro", exportKey: "altro" },
  { key: "total", label: "Totale", exportKey: "totale" },
  { key: "km", label: "Km", exportKey: "km" },
  { key: "taxable", label: "Fiscale", exportKey: "tassabile" },
  { key: "location", label: "Località", exportKey: "localita" },
];

export const PROJECT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Nome", exportKey: "nome" },
  { key: "client", label: "Cliente", exportKey: "cliente" },
  { key: "category", label: "Categoria", exportKey: "categoria" },
  { key: "status", label: "Stato", exportKey: "stato" },
  { key: "period", label: "Periodo", exportKey: "data_inizio" },
];

export const CLIENT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Nome", exportKey: "nome" },
  { key: "type", label: "Tipo", exportKey: "tipo" },
  { key: "phone", label: "Telefono", exportKey: "telefono" },
  { key: "email", label: "Email", exportKey: "email" },
  { key: "source", label: "Fonte", exportKey: "fonte" },
];

export const CONTACT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Referente" },
  { key: "role", label: "Ruolo" },
  { key: "contacts_info", label: "Contatti" },
  { key: "client", label: "Cliente" },
];

/**
 * Filter an export row to only include fields for visible columns.
 */
export function filterExportRow(
  row: Record<string, unknown>,
  visibleKeys: string[],
  columns: ColumnDef[],
): Record<string, unknown> {
  const visibleExportKeys = new Set(
    columns
      .filter((c) => visibleKeys.includes(c.key) && c.exportKey)
      .map((c) => c.exportKey!),
  );
  return Object.fromEntries(
    Object.entries(row).filter(([k]) => visibleExportKeys.has(k)),
  );
}
