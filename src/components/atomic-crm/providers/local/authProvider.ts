import type { AuthProvider } from "ra-core";

import { canAccess } from "../commons/canAccess";
import {
  clearSession,
  exchangeCode,
  hostedLoginUrl,
  hostedLogoutUrl,
  isCognitoConfigured,
  readSession,
  writeSession,
} from "./cognito";
import { getStubCustomerId, setStubCustomerId } from "./principal";

const IDENTITY = {
  "100004": {
    id: "11111111-1111-1111-1111-111111111111",
    fullName: "Woodley LO",
  },
  "100081": {
    id: "22222222-2222-2222-2222-222222222222",
    fullName: "Envoy LO",
  },
} as const;

export const getAuthProvider = (): AuthProvider => {
  if (!isCognitoConfigured()) {
    return {
      login: async (params: { customerId?: string } = {}) => {
        const id = params.customerId === "100081" ? "100081" : "100004";
        setStubCustomerId(id);
      },
      logout: async () => {
        setStubCustomerId("100004");
      },
      checkAuth: async () => undefined,
      checkError: async () => undefined,
      getIdentity: async () => IDENTITY[getStubCustomerId()],
      canAccess: async ({ signal: _signal, ...params }) =>
        canAccess("user", params),
    };
  }

  return {
    login: async () => {
      window.location.assign(hostedLoginUrl());
      return Promise.reject();
    },
    logout: async () => {
      clearSession();
      window.location.assign(hostedLogoutUrl());
      return Promise.reject();
    },
    checkAuth: async () => {
      if (!readSession()) {
        throw new Error("not_authenticated");
      }
    },
    checkError: async (error: { status?: number }) => {
      if (error?.status === 401 || error?.status === 403) {
        clearSession();
        throw error;
      }
    },
    getIdentity: async () => {
      const session = readSession();
      if (!session) throw new Error("not_authenticated");
      return {
        id: session.sub ?? session.email ?? "unknown",
        fullName: session.name || session.email || "Woodley user",
      };
    },
    handleCallback: async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (!code) throw new Error("missing_code");
      const session = await exchangeCode(code);
      writeSession(session);
    },
    canAccess: async ({ signal: _signal, ...params }) =>
      canAccess("user", params),
  };
};
