import type { AuthProvider } from "ra-core";

import { canAccess } from "../commons/canAccess";
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

export const getAuthProvider = (): AuthProvider => ({
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
  canAccess: async ({ signal: _signal, ...params }) => canAccess("user", params),
});
