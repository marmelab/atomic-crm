import { cn } from "@/lib/utils";
import { FILING_STATUS_COLORS, FILING_STATUS_LABELS } from "./filingTypes";
import type { FilingStatus } from "../types";

export const ComplianceStatusBadge = ({
  status,
  className,
}: {
  status: FilingStatus;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
      FILING_STATUS_COLORS[status],
      className,
    )}
  >
    {FILING_STATUS_LABELS[status]}
  </span>
);
