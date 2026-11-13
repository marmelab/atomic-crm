// FIXME: This should be exported from the ra-core package
type CanAccessParams<
  RecordType extends Record<string, any> = Record<string, any>,
> = {
  action: string;
  resource: string;
  record?: RecordType;
};

/**
 * Roles of the frontend, derived from the role in the current business:
 * - admin: owner of the business
 * - accountant: reads and exports, changes nothing
 * - user: every other role
 * The database enforces the same rules (RLS); this only hides what would fail.
 */
export type CrmRole = "admin" | "accountant" | "user";

const READ_ONLY_ACTIONS = ["list", "show", "export"];

export const canAccess = <
  RecordType extends Record<string, any> = Record<string, any>,
>(
  role: string,
  params: CanAccessParams<RecordType>,
) => {
  if (role === "admin") {
    return true;
  }

  // Non admins can't access the sales resource
  if (params.resource === "sales") {
    return false;
  }

  // Non admins can't access the configuration resource
  if (params.resource === "configuration") {
    return false;
  }

  if (role === "accountant") {
    return READ_ONLY_ACTIONS.includes(params.action);
  }

  return true;
};
