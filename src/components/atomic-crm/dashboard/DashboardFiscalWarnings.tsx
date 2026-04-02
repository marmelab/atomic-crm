import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";

import type { FiscalWarning } from "./fiscalModelTypes";

const getWarningClasses = (warning: FiscalWarning) => {
  if (warning.code === "CEILING_CRITICAL") {
    return "bg-destructive/10 text-destructive";
  }

  return "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400";
};

export const DashboardFiscalWarnings = ({
  warnings,
}: {
  warnings: FiscalWarning[];
}) => {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {warnings.map((warning) => (
        <div
          key={`${warning.code}-${warning.taxYear ?? "na"}-${warning.paymentYear ?? "na"}`}
          className={`rounded-md p-3 text-sm ${getWarningClasses(warning)}`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <div className="font-medium">{warning.message}</div>
              {warning.code === "UNMAPPED_TAX_PROFILE" && (
                <div className="flex items-center gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className="border-current/30 bg-transparent"
                  >
                    Stima incompleta
                  </Badge>
                  <Link to="/settings" className="underline underline-offset-2">
                    Controlla Impostazioni → Fiscale
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
