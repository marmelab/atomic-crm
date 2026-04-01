import "./sentry";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

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

// Google redirects to /google-oauth-callback?code=xxx but the app uses HashRouter.
// Convert to /#/google-oauth-callback?code=xxx before React renders.
if (window.location.pathname === "/google-oauth-callback") {
  const query = window.location.search || "";
  // Set hash and clear pathname — this doesn't trigger a page reload
  window.history.replaceState(null, "", `/#/google-oauth-callback${query}`);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
