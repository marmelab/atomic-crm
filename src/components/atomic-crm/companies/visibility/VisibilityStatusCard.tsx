import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { ReactNode } from "react";

export function VisibilityStatusCard({
  title,
  status,
  detail,
  icon,
}: {
  title: string;
  status: "good" | "attention" | "poor" | "missing";
  detail: string;
  icon: ReactNode;
}) {
  const presentation = {
    good: {
      label: "Bra",
      classes: "border-green-200 bg-green-50 text-green-900",
      statusIcon: <CheckCircle2 className="size-4 text-green-600" />,
    },
    attention: {
      label: "Kan förbättras",
      classes: "border-amber-200 bg-amber-50 text-amber-900",
      statusIcon: <AlertTriangle className="size-4 text-amber-600" />,
    },
    poor: {
      label: "Behöver åtgärdas",
      classes: "border-red-200 bg-red-50 text-red-900",
      statusIcon: <XCircle className="size-4 text-red-600" />,
    },
    missing: {
      label: "Data saknas",
      classes: "border-border bg-muted/40 text-foreground",
      statusIcon: <AlertTriangle className="size-4 text-muted-foreground" />,
    },
  }[status];

  return (
    <div className={`rounded-lg border p-4 ${presentation.classes}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <p className="font-medium">{title}</p>
        </div>
        {presentation.statusIcon}
      </div>
      <p className="mt-3 text-sm font-semibold">{presentation.label}</p>
      <p className="mt-1 text-xs opacity-80">{detail}</p>
    </div>
  );
}
