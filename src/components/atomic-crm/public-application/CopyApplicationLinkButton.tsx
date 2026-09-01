import { Link2 } from "lucide-react";
import { useNotify } from "ra-core";
import { Button } from "@/components/ui/button";

// Admin-facing "Copy Application Link" (§16) — a single deterministic
// public URL is enough; no public-form-management system. Used on the
// Living Example page and each Cohort's detail page. Compact visual
// language (outline/sm), matching AddToWaitlistButton.tsx's own button
// right next to it — `label` names the destination so it's clear what
// gets copied before clicking.
//
// URL shape (acceptance-repair pass): /apply/* now lives inside <CRM/>'s
// own HashRouter (root/CRM.tsx), same as every other internal route, so
// the link is "<origin>/#<path>" — matching exactly what the address bar
// shows once there. `window.location.origin` (never a hard-coded host/
// port) means this is already correct for whatever host is actually
// serving the CRM right now; a local dev server obviously still needs to
// be running for a copied localhost link to open (expected local-dev
// behavior, not something this button can or should paper over).
export const CopyApplicationLinkButton = ({
  path,
  label,
}: {
  path: string;
  label: string;
}) => {
  const notify = useNotify();

  const handleClick = async () => {
    const url = `${window.location.origin}/#${path}`;
    try {
      await navigator.clipboard.writeText(url);
      notify(`Application link copied — ${label}`, { type: "info" });
    } catch {
      notify(`Could not copy the link. It's ${url}`, { type: "warning" });
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <Link2 className="size-4" />
      Copy Application Link
    </Button>
  );
};
