import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export const DashboardYoyBadge = ({
  deltaPct,
  previousYear,
  compact = false,
}: {
  deltaPct: number | null;
  previousYear: number;
  compact?: boolean;
}) => {
  if (deltaPct == null) return null;

  const direction = deltaPct > 0 ? "up" : deltaPct < 0 ? "down" : "flat";

  if (direction === "flat") {
    return (
      <Badge variant="secondary" className="text-[10px]">
        = vs {previousYear}
      </Badge>
    );
  }

  const Icon = direction === "up" ? ArrowUpRight : ArrowDownRight;
  const variant = direction === "up" ? "success" : "destructive";
  const prefix = direction === "up" ? "+" : "";

  return (
    <Badge variant={variant} className="gap-0.5 text-[10px]">
      <Icon className="h-3 w-3" />
      {prefix}
      {Math.round(deltaPct)}%{!compact && ` vs ${previousYear}`}
    </Badge>
  );
};
