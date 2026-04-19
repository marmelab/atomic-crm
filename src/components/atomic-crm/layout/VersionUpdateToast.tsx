import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { useVersionCheck } from "./useVersionCheck";

export function VersionUpdateToast() {
  const { hasUpdate, latestVersion, reload } = useVersionCheck();
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!hasUpdate || dismissed === latestVersion) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-22 right-6 z-[60] max-w-xs animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-start gap-3 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg shadow-black/20 p-3 pr-2">
        <span className="relative flex h-2.5 w-2.5 mt-1.5 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--nosho-green)] opacity-75 animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--nosho-green)]" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">
            Nouvelle version disponible
          </p>
          {latestVersion && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {latestVersion} — rechargez pour en profiter.
            </p>
          )}
          <button
            type="button"
            onClick={reload}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[var(--nosho-green)] hover:bg-[var(--nosho-green-dark)] text-white text-xs font-medium px-2.5 py-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Recharger
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(latestVersion)}
          aria-label="Ignorer"
          className="text-muted-foreground hover:text-foreground transition-colors rounded p-1 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
