import type { AuthProvider } from "ra-core";

import type { Sale } from "../../types";
import { canAccess } from "../commons/canAccess";
import { baseDataProvider } from "./internal/httpClient";

// This is a single-user, no-login deployment: there is no real authentication.
// The app still needs an "identity" (a row in `sales`) for record ownership and
// role checks, so we treat the first `sales` row as the current user, and a
// one-time onboarding (/sign-up) creates it when the database is empty.
//
// State is cached in localStorage to avoid a round-trip on every check; caches
// are cleared on logout and refreshed on demand.
const IS_INITIALIZED_CACHE_KEY = "RaStore.auth.is_initialized";
const CURRENT_SALE_CACHE_KEY = "RaStore.auth.current_sale";

function getLocalStorage(): Storage | null {
  return typeof window !== "undefined" ? window.localStorage : null;
}

async function fetchFirstSale(): Promise<Sale | null> {
  const { data } = await baseDataProvider.getList<Sale>("sales", {
    filter: {},
    pagination: { page: 1, perPage: 1 },
    sort: { field: "id", order: "ASC" },
  });
  return data[0] ?? null;
}

export async function getIsInitialized(): Promise<boolean> {
  const storage = getLocalStorage();
  const cached = storage?.getItem(IS_INITIALIZED_CACHE_KEY);
  if (cached != null) {
    return cached === "true";
  }
  const sale = await fetchFirstSale();
  if (sale) {
    storage?.setItem(IS_INITIALIZED_CACHE_KEY, "true");
  }
  return sale != null;
}

async function getCurrentSale(): Promise<Sale | null> {
  const storage = getLocalStorage();
  const cached = storage?.getItem(CURRENT_SALE_CACHE_KEY);
  if (cached != null) {
    return JSON.parse(cached) as Sale;
  }
  const sale = await fetchFirstSale();
  if (sale) {
    storage?.setItem(CURRENT_SALE_CACHE_KEY, JSON.stringify(sale));
  }
  return sale;
}

/** Called by the data provider after signUp / profile updates. */
export function cacheCurrentSale(sale: Sale) {
  const storage = getLocalStorage();
  storage?.setItem(IS_INITIALIZED_CACHE_KEY, "true");
  storage?.setItem(CURRENT_SALE_CACHE_KEY, JSON.stringify(sale));
}

function clearCache() {
  const storage = getLocalStorage();
  storage?.removeItem(IS_INITIALIZED_CACHE_KEY);
  storage?.removeItem(CURRENT_SALE_CACHE_KEY);
}

const ONBOARDING_PATHS = ["/sign-up"];

function isOnboardingRoute(): boolean {
  if (typeof window === "undefined") return false;
  const { pathname, hash } = window.location;
  return ONBOARDING_PATHS.some(
    (path) => pathname === path || hash.includes(`#${path}`),
  );
}

export const getAuthProvider = (): AuthProvider => ({
  // No real credentials: "login" just adopts the current (first) sale.
  login: async () => {
    await getCurrentSale();
    return undefined;
  },
  logout: async () => {
    clearCache();
    return undefined;
  },
  checkError: async () => undefined,
  checkAuth: async () => {
    if (isOnboardingRoute()) return;
    const initialized = await getIsInitialized();
    if (!initialized) {
      throw { redirectTo: "/sign-up", message: false };
    }
  },
  canAccess: async ({ signal: _signal, ...params }) => {
    const initialized = await getIsInitialized();
    if (!initialized) return false;
    const sale = await getCurrentSale();
    if (!sale) return false;
    const role = sale.administrator ? "admin" : "user";
    return canAccess(role, params as any);
  },
  getIdentity: async () => {
    const sale = await getCurrentSale();
    if (!sale) {
      throw new Error("No user found");
    }
    return {
      id: sale.id,
      fullName: `${sale.first_name} ${sale.last_name}`,
      avatar: sale.avatar?.src,
    };
  },
});
