import type { SalesRole } from "../../types";

// FIXME: This should be exported from the ra-core package
type CanAccessParams<
  RecordType extends Record<string, any> = Record<string, any>,
> = {
  action: string;
  resource: string;
  record?: RecordType;
};

/** Resources only an admin can reach. */
const ADMIN_RESOURCES = new Set(["sales", "configuration"]);

/**
 * Team-management resources: lead import, assignments, recycle pool,
 * WhatsApp approvals and reports. The database enforces the same split
 * (is_manager() in RLS and RPCs); this only shapes the UI.
 */
export const MANAGER_RESOURCES = new Set([
  "import_batches",
  "lead_import",
  "call_assignments",
  "recycle_pool",
  "whatsapp_approvals",
  "brochures",
  "reports",
]);

const ROLES: readonly SalesRole[] = ["admin", "manager", "bde"];

/**
 * The role of a sales record. Records written before roles existed only carry
 * the administrator flag: they map to admin, or to manager (the full access
 * every non-admin user had before).
 */
export const resolveRole = (sale: {
  role?: string | null;
  administrator?: boolean | null;
}): SalesRole => {
  if (sale.role && ROLES.includes(sale.role as SalesRole)) {
    return sale.role as SalesRole;
  }
  return sale.administrator ? "admin" : "manager";
};

export const canAccess = <
  RecordType extends Record<string, any> = Record<string, any>,
>(
  role: SalesRole,
  params: CanAccessParams<RecordType>,
) => {
  if (role === "admin") {
    return true;
  }
  if (ADMIN_RESOURCES.has(params.resource)) {
    return false;
  }
  if (MANAGER_RESOURCES.has(params.resource)) {
    return role === "manager";
  }
  return true;
};
