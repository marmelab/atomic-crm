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
} => ({
  getList: async (resource) => {
    const path =
      resource === "contacts"
        ? "/contacts"
        : resource === "companies"
          ? "/companies"
          : resource === "deals"
            ? "/deals"
            : null;
    if (path) {
      const body = await api<{ data: Record<string, unknown>[]; total: number }>(
        path,
      );
      return {
        data: body.data.map((row) => ({ ...row, id: row.id })),
        total: body.total,
      };
    }
    return emptyList;
  },
  getOne: async () => {
    throw new Error("getOne is not wired on the W0 local path");
  },
  getMany: async () => ({ data: [] }),
  getManyReference: async () => emptyList,
  create: async () => {
    throw new Error("writes are not wired on the W0 local path");
  },
  update: async () => {
    throw new Error("writes are not wired on the W0 local path");
  },
  updateMany: async () => ({ data: [] }),
  delete: async () => {
    throw new Error("writes are not wired on the W0 local path");
  },
  deleteMany: async () => ({ data: [] }),
  getConfiguration: async () => ({}) as ConfigurationContextValue,
  isInitialized: async () => true,
});
