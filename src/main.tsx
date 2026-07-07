import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Supabase OAuth consent: Vercel HTTP redirects may land on /?authorization_id=…
// (when oauth-consent.html cannot run JS). Forward into the hash route.
const oauthAuthorizationId = new URLSearchParams(window.location.search).get(
  "authorization_id",
);
if (oauthAuthorizationId && !window.location.hash.includes("/oauth/consent")) {
  window.location.replace(
    `${window.location.origin}/#/oauth/consent?authorization_id=${encodeURIComponent(oauthAuthorizationId)}`,
  );
}

// After a new deploy, the service worker may replace its pre-cache while
// the page still holds old chunk references. A reload picks up the new
// HTML + new SW cache. A sessionStorage guard prevents infinite loops.
// See https://vite.dev/guide/build.html#load-error-handling
window.addEventListener("vite:preloadError", () => {
  const key = "chunk-reload";
  if (!sessionStorage.getItem(key)) {
    sessionStorage.setItem(key, "1");
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
