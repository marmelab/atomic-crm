// Shared "this link isn't valid / isn't open" body for the public /apply
// pages — never exposes why in CRM terms (no "cohort", no internal id), a
// calm human-facing notice either way (§14).
//
// Fixed white-on-dark tone (not a theme token): PublicApplicationLayout
// now renders a deliberately fixed dark background regardless of the
// visitor's own system theme (Real LE + GYU Application Forms slice,
// Phase 5) — `text-muted-foreground` would resolve to a near-invisible
// dark gray against it in light mode.
export const NotFoundNotice = ({
  message = "Please check the link you were given, or reach out if you think this is a mistake.",
}: {
  message?: string;
}) => <p className="text-sm text-white/50 text-center">{message}</p>;
