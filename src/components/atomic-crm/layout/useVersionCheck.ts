import { useCallback, useEffect, useState } from "react";
import { APP_VERSION } from "../../../version";

const POLL_INTERVAL_MS = 5 * 60 * 1000;

type VersionPayload = { version?: string };

async function fetchRemoteVersion(): Promise<string | null> {
  try {
    const url = `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data: VersionPayload = await res.json();
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

export function useVersionCheck() {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const remote = await fetchRemoteVersion();
      if (cancelled || !remote) return;
      if (remote !== APP_VERSION) {
        setLatestVersion(remote);
      }
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  return {
    hasUpdate: latestVersion !== null,
    currentVersion: APP_VERSION,
    latestVersion,
    reload,
  };
}
