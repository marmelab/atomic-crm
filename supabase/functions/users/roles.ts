export const SALES_ROLES = ["admin", "manager", "bde"] as const;
export type SalesRole = (typeof SALES_ROLES)[number];

/**
 * The role wins over the legacy administrator flag when both are sent; a
 * client that only knows the flag keeps working (true -> admin, false ->
 * the role is left to the database sync trigger).
 */
export function resolveRoleUpdate(
  role: unknown,
  administrator: unknown,
): { role?: SalesRole; administrator: boolean } {
  if (role !== undefined && role !== null) {
    if (!SALES_ROLES.includes(role as SalesRole)) {
      throw Object.assign(new Error(`Invalid role: ${String(role)}`), {
        status: 400,
      });
    }
    return { role: role as SalesRole, administrator: role === "admin" };
  }
  return { administrator: !!administrator };
}
