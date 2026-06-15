import { useCallback, useEffect, useState } from "react";

import { ThemeProviderContext, type Theme } from "./theme-context";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

const isBrowser = typeof window !== "undefined";

/**
 * Stable localStorage key for the persisted theme preference.
 *
 * Kept independent from the ra-core application store on purpose: the ra store
 * is namespaced/versioned and can be reset, which made the theme fall back to
 * the default on every login. A plain localStorage key survives logout/login
 * and page reloads. Must match the key used by the inline boot script in
 * index.html that applies the theme before React mounts (avoids a flash).
 */
const DEFAULT_STORAGE_KEY = "eswatini-crm-theme";

const isTheme = (value: unknown): value is Theme =>
  value === "light" || value === "dark" || value === "system";

const readStoredTheme = (storageKey: string, fallback: Theme): Theme => {
  if (!isBrowser) return fallback;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (isTheme(stored)) return stored;
  } catch {
    // localStorage may be unavailable (private mode, blocked cookies, ...)
  }
  return fallback;
};

const applyTheme = (theme: Theme) => {
  if (!isBrowser) return;
  const root = window.document.documentElement;
  root.classList.remove("light", "dark");
  const resolved =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  root.classList.add(resolved);
};

/**
 * Theme provider that enables light, dark, and system theme modes.
 *
 * The selected theme is persisted to localStorage so it stays consistent
 * across logins and reloads.
 *
 * @internal
 */
export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = DEFAULT_STORAGE_KEY,
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() =>
    readStoredTheme(storageKey, defaultTheme),
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Keep following the OS preference while in "system" mode.
  useEffect(() => {
    if (theme !== "system" || !isBrowser) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback(
    (next: Theme) => {
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // Persisting is best-effort; still update the in-memory theme.
      }
      setThemeState(next);
    },
    [storageKey],
  );

  const value = {
    theme,
    setTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}
