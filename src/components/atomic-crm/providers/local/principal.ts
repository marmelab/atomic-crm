export const CUSTOMER_STORAGE_KEY = "ardley-crm.customer-id";

export type StubCustomerId = "100004" | "100081";

export function getStubCustomerId(): StubCustomerId {
  if (typeof window === "undefined") return "100004";
  const stored = window.localStorage.getItem(CUSTOMER_STORAGE_KEY);
  if (stored === "100081" || stored === "100004") return stored;
  return "100004";
}

export function setStubCustomerId(id: StubCustomerId) {
  window.localStorage.setItem(CUSTOMER_STORAGE_KEY, id);
}
