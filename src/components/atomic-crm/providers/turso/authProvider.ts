import type { AuthProvider } from "ra-core";
import { canAccess } from "../commons/canAccess";

const PASSWORD = "bite";
const BLOCK_DURATION = 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const AUTH_KEY = "app_auth";
const ATTEMPTS_KEY = "app_login_attempts";

interface LoginAttempts {
  count: number;
  blockedUntil: number | null;
}

function getAttempts(): LoginAttempts {
  if (typeof window === "undefined") return { count: 0, blockedUntil: null };
  const raw = localStorage.getItem(ATTEMPTS_KEY);
  if (!raw) return { count: 0, blockedUntil: null };
  try {
    return JSON.parse(raw);
  } catch {
    return { count: 0, blockedUntil: null };
  }
}

function setAttempts(data: LoginAttempts) {
  if (typeof window !== "undefined") {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(data));
  }
}

function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTH_KEY) === "1";
}

export function getIsInitialized(): Promise<boolean> {
  return Promise.resolve(true);
}

export function cacheCurrentSale(_sale: any) {
  // no-op since we removed sign-up flow
}

export const getAuthProvider = (): AuthProvider => ({
  login: async ({ password }: { password?: string }) => {
    const attempts = getAttempts();

    if (attempts.blockedUntil && Date.now() < attempts.blockedUntil) {
      const remaining = Math.ceil((attempts.blockedUntil - Date.now()) / 60000);
      throw new Error(
        `Trop de tentatives. Réessayez dans ${remaining} minute${remaining > 1 ? "s" : ""}.`,
      );
    }

    if (password !== PASSWORD) {
      const newCount = attempts.count + 1;
      if (newCount >= MAX_ATTEMPTS) {
        setAttempts({
          count: newCount,
          blockedUntil: Date.now() + BLOCK_DURATION,
        });
        throw new Error(
          "3 tentatives échouées. Compte bloqué pendant 1 heure.",
        );
      }
      setAttempts({ count: newCount, blockedUntil: null });
      throw new Error("Mot de passe incorrect.");
    }

    setAttempts({ count: 0, blockedUntil: null });
    if (typeof window !== "undefined") {
      localStorage.setItem(AUTH_KEY, "1");
    }
    return undefined;
  },
  logout: async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(AUTH_KEY);
    }
    return undefined;
  },
  checkError: async () => undefined,
  checkAuth: async () => {
    if (!isAuthenticated()) {
      throw new Error("Not authenticated");
    }
  },
  canAccess: async (params: any) => {
    return canAccess("admin", params as any);
  },
  getIdentity: async () => ({
    id: "admin",
    fullName: "Admin",
  }),
});
