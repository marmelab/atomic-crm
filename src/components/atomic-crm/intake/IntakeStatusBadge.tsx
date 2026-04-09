import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusClasses: Record<string, string> = {
  new: "border-blue-500/60 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  contacted:
    "border-yellow-500/60 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  responded:
    "border-green-500/60 bg-green-500/10 text-green-700 dark:text-green-300",
  qualified:
    "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rejected:
    "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300",
};

export const IntakeStatusBadge = ({ status }: { status: string }) => {
  const label = status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : "";

  return (
    <Badge
      variant="outline"
      className={cn("capitalize", statusClasses[status] ?? "border-border")}
    >
      {label || "Unknown"}
    </Badge>
  );
};
