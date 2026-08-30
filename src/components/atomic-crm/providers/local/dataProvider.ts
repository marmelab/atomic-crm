import type { DataProvider } from "ra-core";

import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import { getStubCustomerId } from "./principal";

const API_BASE = import.meta.env.VITE_CRM_API_URL ?? "http://127.0.0.1:8787";

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "x-ardley-customer-id": getStubCustomerId(),
    },
  });
  if (!res.ok) {
    throw new Error(`local-bff ${path} ${res.status}`);
  }
  return (await res.json()) as T;
}

const emptyList = { data: [] as never[], total: 0 };

export const getDataProvider = (): DataProvider & {
  getConfiguration: () => Promise<ConfigurationContextValue>;
  isInitialized: () => Promise<boolean>;
} =>
  ({
    getList: async (resource) => {
      const path =
        resource === "contacts"
          ? "/contacts"
          : resource === "companies"
            ? "/companies"
            : resource === "deals"
              ? "/deals"
              : resource === "pipeline_stages"
                ? "/pipeline-stages"
                : resource === "pipelines"
                  ? "/pipelines"
                  : resource === "saved_views"
                    ? "/saved-views"
                    : null;
      if (path) {
        const body = await api<{
          data: Record<string, unknown>[];
          total: number;
        }>(path);
        return {
          data: body.data.map((row) => ({ ...row, id: row.id })),
          total: body.total,
        };
      }
      return emptyList;
    },
    getOne: async (resource, params) => {
      const path =
        resource === "contacts"
          ? `/contacts/${params.id}`
          : resource === "companies"
            ? `/companies/${params.id}`
            : resource === "deals"
              ? `/deals/${params.id}`
              : null;
      if (!path) {
        throw new Error(`getOne is not wired for ${resource}`);
      }
      const body = await api<{ data: Record<string, unknown> }>(path);
      return { data: { ...body.data, id: body.data.id } };
    },
    getMany: async () => ({ data: [] }),
    getManyReference: async () => emptyList,
    create: async () => {
      throw new Error("writes are not wired on the W0 local path");
    },
    update: async (resource, params) => {
      if (resource !== "deals") {
        throw new Error("writes are not wired on the W0 local path");
      }
      const res = await fetch(`${API_BASE}/deals/${params.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-ardley-customer-id": getStubCustomerId(),
        },
        body: JSON.stringify({ stage_id: params.data.stage_id }),
      });
      if (!res.ok) {
        throw new Error(`local-bff PATCH /deals/${params.id} ${res.status}`);
      }
      const body = (await res.json()) as { data: Record<string, unknown> };
      return { data: { ...params.previousData, ...params.data, ...body.data } };
    },
    updateMany: async () => ({ data: [] }),
    delete: async () => {
      throw new Error("writes are not wired on the W0 local path");
    },
    deleteMany: async () => ({ data: [] }),
    getConfiguration: async () => ({}) as ConfigurationContextValue,
    isInitialized: async () => true,
  }) as DataProvider & {
    getConfiguration: () => Promise<ConfigurationContextValue>;
    isInitialized: () => Promise<boolean>;
  };
