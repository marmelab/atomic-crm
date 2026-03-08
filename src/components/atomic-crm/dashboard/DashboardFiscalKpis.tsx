import { AlertTriangle, Shield } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

import { formatCurrency, formatCurrencyPrecise } from "./dashboardModel";
import type { FiscalKpis, FiscalWarning } from "./fiscalModel";

const getCeilingVariant = (pct: number) => {
  if (pct >= 90) return "destructive" as const;
  if (pct >= 70) return "warning" as const;
  return "success" as const;
};

export const DashboardFiscalKpis = ({
  fiscalKpis,
  warnings,
  isCurrentYear = true,
}: {
  fiscalKpis: FiscalKpis;
  warnings: FiscalWarning[];
  isCurrentYear?: boolean;
}) => {
  const hasCeilingWarning =
    isCurrentYear &&
    warnings.some(
      (w) => w.type === "ceiling_exceeded" || w.type === "ceiling_critical",
    );
  const totalTax = fiscalKpis.stimaInpsAnnuale + fiscalKpis.stimaImpostaAnnuale;
  const netPct = Math.round(fiscalKpis.percentualeNetto);
  const ceilingPct = Math.round(fiscalKpis.percentualeUtilizzoTetto);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* ── Reddito netto ── */}
      <Card className="gap-3 py-4">
        <CardHeader className="px-4 pb-0">
          <CardTitle className="text-base font-semibold">
            Netto stimato
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
              {formatCurrency(fiscalKpis.redditoNettoStimato)}
            </span>
            <span
              className={`text-sm font-semibold ${netPct >= 60 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
            >
              {netPct}%
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Su {formatCurrencyPrecise(fiscalKpis.fatturatoLordoYtd)} incassato
            {fiscalKpis.fatturatoNonTassabileYtd > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {" "}
                (+{formatCurrencyPrecise(
                  fiscalKpis.fatturatoNonTassabileYtd,
                )}{" "}
                non tassabile)
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* ── Tasse: INPS | Imposta ── */}
      <Card className="gap-3 py-4">
        <CardHeader className="px-4 pb-0">
          <CardTitle className="text-base font-semibold">
            Tasse stimate
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 space-y-2">
          <div className="text-2xl font-bold text-red-700 dark:text-red-300 tabular-nums">
            {formatCurrency(totalTax)}
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-0 text-xs text-muted-foreground">
            <div className="pr-2 text-center">
              <div className="font-semibold text-foreground tabular-nums">
                {formatCurrencyPrecise(fiscalKpis.stimaInpsAnnuale)}
              </div>
              <div>INPS</div>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="pl-2 text-center">
              <div className="font-semibold text-foreground tabular-nums">
                {formatCurrencyPrecise(fiscalKpis.stimaImpostaAnnuale)}
              </div>
              <div>Imposta {fiscalKpis.aliquotaSostitutiva}%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Accantonamento mensile ── */}
      <Card className="gap-3 py-4">
        <CardHeader className="px-4 pb-0">
          <CardTitle className="text-base font-semibold">
            Accantona al mese
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 space-y-2">
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300 tabular-nums">
            {formatCurrencyPrecise(fiscalKpis.accantonamentoMensile)}
          </div>
          <p className="text-xs text-muted-foreground">
            {isCurrentYear
              ? "Da mettere da parte per tasse"
              : "Media mensile teorica"}
          </p>
        </CardContent>
      </Card>

      {/* ── Distanza dal tetto ── */}
      <Card
        className={`gap-3 py-4 ${hasCeilingWarning ? "border-destructive" : ""}`}
      >
        <CardHeader className="px-4 pb-0 flex flex-row items-center justify-between space-y-0 gap-2">
          <CardTitle className="text-base font-semibold">
            Tetto forfettario
          </CardTitle>
          {hasCeilingWarning ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          )}
        </CardHeader>
        <CardContent className="px-4 space-y-2">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tabular-nums ${
                fiscalKpis.distanzaDalTetto < 0
                  ? "text-red-700 dark:text-red-300"
                  : "text-foreground"
              }`}
            >
              {formatCurrency(Math.abs(fiscalKpis.distanzaDalTetto))}
            </span>
            <span className="text-sm text-muted-foreground">
              {fiscalKpis.distanzaDalTetto < 0 ? "oltre" : "liberi"}
            </span>
          </div>
          <Progress
            value={Math.min(100, ceilingPct)}
            variant={getCeilingVariant(ceilingPct)}
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">{ceilingPct}% usato</p>
        </CardContent>
      </Card>
    </div>
  );
};
