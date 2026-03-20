import "./sentry";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

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
