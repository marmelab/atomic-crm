import { useTranslate } from "ra-core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusClasses: Record<string, string> = {
  uncontacted:
    "border-blue-500/60 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "in-sequence":
    "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  engaged:
    "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-300",
  "not-interested":
    "border-slate-400/60 bg-slate-400/10 text-slate-600 dark:text-slate-300",
  unresponsive:
    "border-orange-500/60 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  qualified:
    "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rejected:
    "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300",
};

export const IntakeStatusBadge = ({ status }: { status: string }) => {
  const translate = useTranslate();
  const fallback = status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : "";
  const label = translate(`resources.intake_leads.status.${status}`, {
    _: fallback || translate("resources.intake_leads.status.unknown", { _: "Unknown" }),
  });

  return (
    <Badge
      variant="outline"
      className={cn("capitalize", statusClasses[status] ?? "border-border")}
    >
      {label}
    </Badge>
  );
};
