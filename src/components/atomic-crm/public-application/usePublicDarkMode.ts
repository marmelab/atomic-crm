import { useEffect } from "react";

// A minimal, standalone equivalent of components/admin/theme-provider.tsx
// for the public /apply routes, which render completely outside
// CoreAdminContext (no ra-core Store to read a saved preference from — see
// public-application/PublicApplicationApp.tsx's own header). System
// preference only: an anonymous applicant has no CRM theme setting to
// restore, and this form isn't the place to build a theme toggle (§3 is
// "dark mode compatible", not "themeable").
export const usePublicDarkMode = () => {
  useEffect(() => {
    const root = window.document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      root.classList.remove("light", "dark");
      root.classList.add(media.matches ? "dark" : "light");
    };

    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      root.classList.remove("light", "dark");
    };
  }, []);
};
