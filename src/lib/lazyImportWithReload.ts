import React from "react";

/**
 * Lazy-load with a full page reload on chunk load failure.
 * After a new deploy, the old service worker pre-cache may be replaced
 * while the page still holds old chunk references. A reload picks up
 * the new HTML + new SW cache, resolving the mismatch.
 * A sessionStorage guard prevents infinite reload loops.
 * Fow when we are offline with no cached version, the error is surfaced as usual.
 */
export function lazyImportWithReload<T extends React.ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  chunkName: string,
) {
  return React.lazy(() =>
    importFn().catch(() => {
      const key = `chunk-reload:${chunkName}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
      }
      // If we already reloaded once this session, surface the error
      return Promise.reject(
        new Error(`Failed to load chunk "${chunkName}" after reload`),
      );
    }),
  );
}
