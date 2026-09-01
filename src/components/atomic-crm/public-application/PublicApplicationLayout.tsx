import type { ReactNode } from "react";

// The public /apply pages' own calm, mobile-first shell — deliberately NOT
// the admin Layout/MobileLayout (§3): no sidebar, no nav, no CRM chrome.
// A single centered, rounded, contained surface — the same visual
// language (rounded borders, generous padding for content, theme tokens)
// as the rest of the accepted CRM, just without any of its admin
// structure. `orientation` is the one short sentence §3 asks for; content
// beyond that is left to the caller so this stays a pure layout shell.
//
// Dark mode (acceptance-repair pass): these routes are now registered
// inside <CRM/>'s own <Admin> tree (root/CRM.tsx), which already wraps
// EVERY route — including the unauthenticated CustomRoutes ones — in the
// real components/admin/theme-provider.tsx (system-preference-aware,
// respects a returning Leif's own saved choice too). No separate dark-mode
// effect is needed here anymore.
export const PublicApplicationLayout = ({
  title,
  orientation,
  children,
}: {
  title: string;
  orientation: string;
  children: ReactNode;
}) => (
  <div className="min-h-screen bg-background text-foreground flex justify-center px-4 py-10 sm:py-16">
    <div className="w-full max-w-md flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{orientation}</p>
      </div>
      <div className="rounded-xl border bg-card text-card-foreground shadow-xs p-5 sm:p-6">
        {children}
      </div>
    </div>
  </div>
);
