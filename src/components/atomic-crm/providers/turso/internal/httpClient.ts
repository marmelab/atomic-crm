import { HttpError, type DataProvider } from "ra-core";

/**
 * Low-level data provider that talks to the Atomic CRM backend
 * (server/index.mjs) over HTTP. Each method POSTs to
 * `${API_URL}/:resource/:method` with a JSON body matching the react-admin
 * DataProvider params, and the backend returns the matching react-admin shape.
 *
 * The backend understands the app's PostgREST-style `field@operator` filters
 * directly, so filters are forwarded unchanged.
 */
const API_URL = import.meta.env.VITE_API_URL ?? "/api";

async function apiFetch<T = any>(
  resource: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${API_URL}/${resource}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpError(
      json?.error ?? response.statusText,
      response.status,
      json,
    );
  }
  return json as T;
}

export const baseDataProvider: DataProvider = {
  getList: (resource, params) =>
    apiFetch(resource, "getList", {
      filter: params.filter,
      sort: params.sort,
      pagination: params.pagination,
    }),
  getOne: (resource, params) => apiFetch(resource, "getOne", { id: params.id }),
  getMany: (resource, params) =>
    apiFetch(resource, "getMany", { ids: params.ids }),
  getManyReference: (resource, params) =>
    apiFetch(resource, "getManyReference", {
      target: params.target,
      id: params.id,
      filter: params.filter,
      sort: params.sort,
      pagination: params.pagination,
    }),
  create: (resource, params) =>
    apiFetch(resource, "create", { data: params.data }),
  update: (resource, params) =>
    apiFetch(resource, "update", { id: params.id, data: params.data }),
  updateMany: (resource, params) =>
    apiFetch(resource, "updateMany", { ids: params.ids, data: params.data }),
  delete: (resource, params) => apiFetch(resource, "delete", { id: params.id }),
  deleteMany: (resource, params) =>
    apiFetch(resource, "deleteMany", { ids: params.ids }),
};
