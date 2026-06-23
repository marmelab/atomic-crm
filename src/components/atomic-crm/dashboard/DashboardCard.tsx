import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  title: string;
  icon?: LucideIcon;
  /** Optional element rendered at the right of the header (tabs, button, value). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

/**
 * Consistent card shell for every dashboard widget: a calm header with a small
 * muted icon + title and an optional action slot, over a soft-elevated card.
 * Replaces the previous oversized colored headers so the dashboard reads as one
 * cohesive, professional surface.
 */
export const DashboardCard = ({
  title,
  icon: Icon,
  action,
  children,
  className,
  contentClassName,
}: DashboardCardProps) => (
  <Card
    className={cn(
      "gap-0 py-0 overflow-hidden shadow-[var(--shadow-card)]",
      className,
    )}
  >
    <div className="flex items-center justify-between gap-2 border-b px-5 py-3.5">
      <div className="flex items-center gap-2 min-w-0">
        {Icon ? (
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : null}
        <h2 className="truncate text-sm font-semibold text-foreground">
          {title}
        </h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
    <CardContent className={cn("p-5", contentClassName)}>
      {children}
    </CardContent>
  </Card>
);
