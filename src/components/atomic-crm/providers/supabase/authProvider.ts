import type { AuthProvider } from "ra-core";
import { supabaseAuthProvider } from "ra-supabase-core";

import { canAccess, resolveRole } from "../commons/canAccess";
import { getSupabaseClient } from "./supabase";

const getBaseAuthProvider = () =>
  supabaseAuthProvider(getSupabaseClient(), {
    getIdentity: async () => {
      const sale = await getSale();

      if (sale == null) {
        throw new Error();
      }

      return {
        id: sale.id,
        fullName: `${sale.first_name} ${sale.last_name}`,
        avatar: sale.avatar?.src,
      };
    },
  });

// To speed up checks, we cache the initialization state
// and the current sale in the local storage. They are cleared on logout.
const IS_INITIALIZED_CACHE_KEY = "RaStore.auth.is_initialized";
const CURRENT_SALE_CACHE_KEY = "RaStore.auth.current_sale";

function getLocalStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
}

export async function getIsInitialized() {
  const storage = getLocalStorage();
  const cachedValue = storage?.getItem(IS_INITIALIZED_CACHE_KEY);
  if (cachedValue != null) {
    return cachedValue === "true";
  }

  const { data } = await getSupabaseClient()
    .from("init_state")
    .select("is_initialized");
  const isInitialized = data?.at(0)?.is_initialized > 0;

  if (isInitialized) {
    storage?.setItem(IS_INITIALIZED_CACHE_KEY, "true");
  }

  return isInitialized;
}

/** How long the cached sales record (role, disabled flag) is trusted. */
export const SALE_CACHE_TTL_MS = 60_000;

type CurrentSale = {
  id: number;
  first_name: string;
  last_name: string;
  avatar?: { src?: string } | null;
  administrator: boolean;
  role?: string | null;
  disabled?: boolean;
};

/**
 * The current user's sales record, cached for SALE_CACHE_TTL_MS so a role
 * change or an account disabling reaches the UI within a minute (and at once
 * with `force`, used before sensitive actions). The database enforces both
 * immediately anyway: a disabled user has no role there, so RLS returns no row.
 */
const getSale = async ({ force = false } = {}): Promise<
  CurrentSale | undefined
> => {
  const storage = getLocalStorage();
  const cachedValue = storage?.getItem(CURRENT_SALE_CACHE_KEY);
  if (cachedValue != null && !force) {
    try {
      const cached = JSON.parse(cachedValue) as {
        sale?: CurrentSale;
        fetchedAt?: number;
      };
      if (
        cached.sale &&
        typeof cached.fetchedAt === "number" &&
        Date.now() - cached.fetchedAt < SALE_CACHE_TTL_MS
      ) {
        return cached.sale;
      }
    } catch {
      // Unreadable cache (or the pre-TTL format): fetch it again below.
    }
  }

  const { data: dataSession, error: errorSession } =
    await getSupabaseClient().auth.getSession();

  // Shouldn't happen after login but just in case
  if (dataSession?.session?.user == null || errorSession) {
    return undefined;
  }

  const { data: dataSale, error: errorSale } = await getSupabaseClient()
    .from("sales")
    .select("id, first_name, last_name, avatar, administrator, role, disabled")
    .match({ user_id: dataSession?.session?.user.id })
    .single();

  if (dataSale == null || errorSale || dataSale.disabled) {
    storage?.removeItem(CURRENT_SALE_CACHE_KEY);
    return undefined;
  }

  storage?.setItem(
    CURRENT_SALE_CACHE_KEY,
    JSON.stringify({ sale: dataSale, fetchedAt: Date.now() }),
  );
  return dataSale;
};

/** Re-reads the role and disabled flag now; call before sensitive actions. */
export const refreshCurrentSale = () => getSale({ force: true });

function clearCache() {
  const storage = getLocalStorage();
  storage?.removeItem(IS_INITIALIZED_CACHE_KEY);
  storage?.removeItem(CURRENT_SALE_CACHE_KEY);
}

export const getAuthProvider = (): AuthProvider => {
  const baseAuthProvider = getBaseAuthProvider();
  return {
    ...baseAuthProvider,
    login: async (params) => {
      if (params.ssoDomain) {
        const { error } = await getSupabaseClient().auth.signInWithSSO({
          domain: params.ssoDomain,
        });
        if (error) {
          throw error;
        }
        return;
      }
      return baseAuthProvider.login(params);
    },
    logout: async (params) => {
      clearCache();
      return baseAuthProvider.logout(params);
    },
    checkAuth: async (params) => {
      // Users are on the set-password page, nothing to do
      if (
        window.location.pathname === "/set-password" ||
        window.location.hash.includes("#/set-password")
      ) {
        return;
      }
      // Users are on the forgot-password page, nothing to do
      if (
        window.location.pathname === "/forgot-password" ||
        window.location.hash.includes("#/forgot-password")
      ) {
        return;
      }
      // Users are on the sign-up page, nothing to do
      if (
        window.location.pathname === "/sign-up" ||
        window.location.hash.includes("#/sign-up")
      ) {
        return;
      }

      const isInitialized = await getIsInitialized();

      if (!isInitialized) {
        await getSupabaseClient().auth.signOut();
        throw {
          redirectTo: "/sign-up",
          message: false,
        };
      }

      await baseAuthProvider.checkAuth(params);

      // A disabled (or deleted) account is signed out at the next check.
      const sale = await getSale();
      if (sale == null) {
        clearCache();
        await getSupabaseClient().auth.signOut();
        throw { redirectTo: "/login", message: "ra.auth.auth_check_error" };
      }
    },
    canAccess: async (params) => {
      const isInitialized = await getIsInitialized();
      if (!isInitialized) return false;

      // Get the current user
      const sale = await getSale();
      if (sale == null) return false;

      return canAccess(resolveRole(sale), params);
    },
    getAuthorizationDetails(authorizationId: string) {
      return getSupabaseClient().auth.oauth.getAuthorizationDetails(
        authorizationId,
      );
    },
    approveAuthorization(authorizationId: string) {
      return getSupabaseClient().auth.oauth.approveAuthorization(
        authorizationId,
      );
    },
    denyAuthorization(authorizationId: string) {
      return getSupabaseClient().auth.oauth.denyAuthorization(authorizationId);
    },
  };
};
