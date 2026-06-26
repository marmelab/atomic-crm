import { cn } from "@/lib/utils";

import type { EmailVerification, EmailVerificationStatus } from "../types";

const STATUS_CONFIG: Record<
  EmailVerificationStatus,
  { color: string; label: string }
> = {
  Valid: { color: "#22c55e", label: "Valid" },
  Invalid: { color: "#ef4444", label: "Invalid" },
  "Catch-all": { color: "#f59e0b", label: "Catch-all" },
  Unknown: { color: "#9ca3af", label: "Unknown" },
};

// Small colored dot + hover tooltip showing the verification status and
// diagnosis. Renders nothing when the email has not been verified yet.
// Mirrors the visual pattern of ../misc/Status.tsx.
export const EmailVerificationBadge = ({
  verification,
  className,
}: {
  verification?: EmailVerification;
  className?: string;
}) => {
  if (!verification) return null;

  const config = STATUS_CONFIG[verification.status] ?? STATUS_CONFIG.Unknown;
  const tooltip = verification.diagnosis
    ? `${config.label} — ${verification.diagnosis}`
    : config.label;

  return (
    <div className={cn("group relative inline-block", className)}>
      <span
        role="img"
        className="inline-block w-2.5 h-2.5 rounded-full align-middle"
        style={{ backgroundColor: config.color }}
        aria-label={`Email verification: ${config.label}`}
      />
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
        {tooltip}
      </div>
    </div>
  );
};
