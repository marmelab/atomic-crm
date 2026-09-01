// Shared "this link isn't valid / isn't open" body for the public /apply
// pages — never exposes why in CRM terms (no "cohort", no internal id), a
// calm human-facing notice either way (§14).
export const NotFoundNotice = ({
  message = "Please check the link you were given, or reach out if you think this is a mistake.",
}: {
  message?: string;
}) => <p className="text-sm text-muted-foreground text-center">{message}</p>;
