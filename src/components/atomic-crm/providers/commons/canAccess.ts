// FIXME: This should be exported from the ra-core package
type CanAccessParams<
  RecordType extends Record<string, any> = Record<string, any>,
> = {
  action: string;
  resource: string;
  record?: RecordType;
};

export const canAccess = <
  RecordType extends Record<string, any> = Record<string, any>,
>(
  role: string,
  params: CanAccessParams<RecordType>,
) => {
  if (role === "admin") {
    return true;
  }

  if (params.resource === "luke_command_center") {
    return role === "lead_researcher";
  }

  if (params.resource === "luke_review") {
    return role === "sales_manager";
  }

  if (params.resource === "ai_command_center") {
    return false;
  }

  if (["ai_commands", "ai_audit_events"].includes(params.resource)) {
    return role === "sales_manager" && ["list", "show"].includes(params.action);
  }

  if (role === "viewer") {
    return ["list", "show"].includes(params.action);
  }

  if (role === "lead_researcher") {
    if (["delete", "export"].includes(params.action)) {
      return false;
    }

    if (["sales", "configuration"].includes(params.resource)) {
      return false;
    }

    if (
      ["luke_review", "ai_commands", "ai_audit_events"].includes(
        params.resource,
      )
    ) {
      return false;
    }

    if (
      params.resource === "deals" &&
      !["list", "show"].includes(params.action)
    ) {
      return false;
    }

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

  return true;
};
