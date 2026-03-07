import type { Contact } from "../types";

export const buildContactCreatePath = ({
  clientId,
  projectId,
  supplierId,
}: {
  clientId?: string | null;
  projectId?: string | null;
  supplierId?: string | null;
}) => {
  const searchParams = new URLSearchParams();

  if (clientId) {
    searchParams.set("client_id", clientId);
  }

  if (projectId) {
    searchParams.set("project_id", projectId);
  }

  if (supplierId) {
    searchParams.set("supplier_id", supplierId);
  }

  searchParams.set("launcher_source", "crm_contacts");

  let action = "client_add_contact";
  if (supplierId) action = "supplier_add_contact";
  else if (projectId) action = "project_add_contact";
  searchParams.set("launcher_action", action);

  const search = searchParams.toString();
  return search ? `/contacts/create?${search}` : "/contacts/create";
};

export const getContactCreateDefaultsFromSearch = (
  search: string,
): Partial<Contact> => {
  const searchParams = new URLSearchParams(search);
  const clientId = searchParams.get("client_id");
  const projectId = searchParams.get("project_id");
  const supplierId = searchParams.get("supplier_id");

  return {
    client_id: clientId?.trim() ? clientId : undefined,
    supplier_id: supplierId?.trim() ? supplierId : undefined,
    contact_role: projectId?.trim() ? "operativo" : undefined,
    is_primary_for_client: false,
    email_jsonb: [],
    phone_jsonb: [],
    tags: [],
  };
};

export const getContactCreateLinkContextFromSearch = (search: string) => {
  const searchParams = new URLSearchParams(search);
  const source = searchParams.get("launcher_source");
  const action = searchParams.get("launcher_action");
  const projectId = searchParams.get("project_id")?.trim() || null;

  if (source !== "crm_contacts") {
    return null;
  }

  if (
    action !== "project_add_contact" &&
    action !== "client_add_contact" &&
    action !== "supplier_add_contact"
  ) {
    return null;
  }

  return {
    source,
    action,
    projectId,
  };
};
