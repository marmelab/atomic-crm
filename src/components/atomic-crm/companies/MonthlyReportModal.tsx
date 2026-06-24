import { useEffect, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Loader2, Mail, Sparkles } from "lucide-react";

import type { Company, MonthlyReport, ReportAiContent } from "../types";
import type { VisibilityDataProvider } from "./visibility/types";

/**
 * Månadsrapport-modal: generera draft → granska/redigera → skicka till kund.
 * Speglar CallLogFollowupModal. Edge-funktionen bygger om mail-HTML från
 * redigerad AI-text vid utskick (single source of truth).
 */

const PERIOD_PRESETS: Array<{ value: string; label: string }> = [
  { value: "last_month", label: "Förra månaden" },
  { value: "this_month", label: "Denna månad" },
  { value: "last_2", label: "Senaste 2 månaderna" },
  { value: "quarter", label: "Senaste kvartalet (3 mån)" },
  { value: "half", label: "Senaste halvåret (6 mån)" },
  { value: "year", label: "Senaste året (12 mån)" },
  { value: "custom", label: "Eget månadsintervall" },
];

// Beräknar {period_start, period_end} (hela månader, UTC) för ett snabbval.
function computeReportPeriod(
  preset: string,
  customFrom: string,
  customTo: string,
): { period_start: string; period_end: string } | null {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const range = (backStart: number, backEnd: number) => ({
    period_start: new Date(Date.UTC(y, m + backStart, 1))
      .toISOString()
      .slice(0, 10),
    period_end: new Date(Date.UTC(y, m + backEnd + 1, 0))
      .toISOString()
      .slice(0, 10),
  });
  switch (preset) {
    case "this_month":
      return range(0, 0);
    case "last_month":
      return range(-1, -1);
    case "last_2":
      return range(-2, -1);
    case "quarter":
      return range(-3, -1);
    case "half":
      return range(-6, -1);
    case "year":
      return range(-12, -1);
    case "custom": {
      if (!customFrom || !customTo) return null;
      const [fy, fm] = customFrom.split("-").map(Number);
      const [ty, tm] = customTo.split("-").map(Number);
      if (!fy || !fm || !ty || !tm) return null;
      const start = new Date(Date.UTC(fy, fm - 1, 1));
      const end = new Date(Date.UTC(ty, tm, 0));
      if (start > end) return null;
      return {
        period_start: start.toISOString().slice(0, 10),
        period_end: end.toISOString().slice(0, 10),
      };
    }
    default:
      return range(-1, -1);
  }
}
export const MonthlyReportModal = ({
  company,
  reportId,
  open,
  onOpenChange,
  onSent,
}: {
  company: Company;
  reportId?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}) => {
  const dataProvider = useDataProvider() as VisibilityDataProvider;
  const notify = useNotify();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [periodPreset, setPeriodPreset] = useState("last_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [selectedUpsellService, setSelectedUpsellService] = useState("");
  const [ai, setAi] = useState<ReportAiContent>({
    greeting: "",
    summary: "",
    recommended_action: "",
    upsell_pitch: "",
  });

  useEffect(() => {
    if (!open) return;
    if (!reportId) {
      setReport(null);
      setRecipientEmail("");
      return;
    }
    let active = true;
    dataProvider
      .getOne<MonthlyReport>("monthly_reports", { id: reportId })
      .then(({ data }) => {
        if (!active) return;
        setReport(data);
        setRecipientEmail(data.recipient_email ?? "");
        setSelectedUpsellService(data.selected_upsells[0]?.service ?? "");
        if (data.ai_content) setAi(data.ai_content);
      })
      .catch((error) => {
        if (active) {
          notify(
            error instanceof Error
              ? error.message
              : "Kunde inte öppna rapporten",
            { type: "warning" },
          );
        }
      });
    return () => {
      active = false;
    };
  }, [dataProvider, notify, open, reportId]);

  const loadReport = async (id: number) => {
    const { data } = await dataProvider.getOne<MonthlyReport>(
      "monthly_reports",
      { id },
    );
    setReport(data);
    setRecipientEmail(data.recipient_email ?? "");
    setSelectedUpsellService(data.selected_upsells[0]?.service ?? "");
    if (data.ai_content) setAi(data.ai_content);
  };

  const handleGenerate = async () => {
    const period = computeReportPeriod(periodPreset, customFrom, customTo);
    if (!period) {
      notify("Välj giltigt från- och till-datum för intervallet.", {
        type: "warning",
      });
      return;
    }
    setIsGenerating(true);
    try {
      // Färska bara den senaste månaden när rapporten gäller just den (default).
      // Övriga perioder aggregerar befintlig månadshistorik (kör "Hämta
      // historik" om månader saknas).
      if (periodPreset === "last_month") {
        await dataProvider.analyzeWebsite(company.id, {
          window_kind: "calendar_month",
        });
      }
      const result = await dataProvider.generateMonthlyReport(
        company.id,
        period,
      );
      if (!result.report_id || result.status.startsWith("skipped")) {
        notify(
          result.status === "skipped_no_snapshot"
            ? "Ingen månadsstatistik för perioden — kör 'Hämta historik' på Kund-fliken först."
            : `Rapporten kunde inte skapas (${result.status}).`,
          { type: "warning" },
        );
        return;
      }
      if (result.status.startsWith("failed")) {
        notify(
          "Kunde inte generera rapporttexten (AI-fel). Se rapportens felmeddelande eller försök igen.",
          { type: "error" },
        );
        return;
      }
      await loadReport(result.report_id);
    } catch (error) {
      notify(
        `Fel: ${error instanceof Error ? error.message : "Kunde inte generera rapport"}`,
        { type: "error" },
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!report) return;
    try {
      const result = await dataProvider.getMonthlyReportPdf(report.id);
      window.open(result.signed_url, "_blank", "noopener,noreferrer");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Kunde inte öppna PDF:en",
        { type: "warning" },
      );
    }
  };

  const handleSend = async () => {
    if (!report) return;
    if (!recipientEmail) {
      notify("Ange en mottagar-email innan du skickar.", { type: "warning" });
      return;
    }
    setIsSending(true);
    try {
      await dataProvider.sendMonthlyReport(report.id, {
        recipient_email: recipientEmail,
        ai_content: ai,
      });
      notify(`Rapporten skickad till ${recipientEmail}`, { type: "success" });
      onSent?.();
      onOpenChange(false);
      setReport(null);
    } catch (error) {
      notify(
        `Fel: ${error instanceof Error ? error.message : "Kunde inte skicka rapporten"}`,
        { type: "error" },
      );
    } finally {
      setIsSending(false);
    }
  };

  const upsell =
    report?.selected_upsells.find(
      (offer) => offer.service === selectedUpsellService,
    ) ?? report?.selected_upsells?.[0];
  const canSend = report?.status === "draft" || report?.status === "failed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] grid-rows-[auto_1fr_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Månadsrapport — {company.name}</DialogTitle>
          <DialogDescription>
            Generera, granska och skicka kundens månatliga synlighetsrapport.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto min-h-0 pr-1">
          {!report ? (
            <div className="flex flex-col gap-4 py-6">
              <div className="grid gap-2">
                <Label htmlFor="report-period">Rapportperiod</Label>
                <Select value={periodPreset} onValueChange={setPeriodPreset}>
                  <SelectTrigger id="report-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIOD_PRESETS.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {periodPreset === "custom" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-1">
                      <Label htmlFor="period-from" className="text-xs">
                        Från månad
                      </Label>
                      <Input
                        id="period-from"
                        type="month"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label htmlFor="period-to" className="text-xs">
                        Till månad
                      </Label>
                      <Input
                        id="period-to"
                        type="month"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                      />
                    </div>
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Flermånadersperioder summerar befintlig månadshistorik och
                  jämförs med föregående lika långa period. Saknas månader, kör
                  "Hämta historik" på Kund-fliken först.
                </p>
              </div>
              <Button
                className="self-start"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isGenerating ? "Genererar (~1 min)…" : "Generera rapport"}
              </Button>
            </div>
          ) : (
            <div className="grid gap-5 py-4">
              <div className="grid gap-2">
                <Label htmlFor="report-recipient">Mottagare (e-post)</Label>
                <Input
                  id="report-recipient"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="kontakt@kund.se"
                />
                {!recipientEmail && (
                  <p className="text-xs text-orange-600">
                    Ingen kontakt-email hittades automatiskt — ange en innan du
                    skickar.
                  </p>
                )}
              </div>

              {upsell && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    Föreslagen upsell:
                  </span>
                  <Badge variant="outline">💡 {upsell.label}</Badge>
                </div>
              )}

              {report.selected_upsells.length > 1 ? (
                <div className="grid gap-2">
                  <Label htmlFor="report-recommendation">
                    Rekommenderad huvudåtgärd
                  </Label>
                  <Select
                    value={upsell?.service}
                    onValueChange={(service) => {
                      const selected = report.selected_upsells.find(
                        (offer) => offer.service === service,
                      );
                      if (!selected) return;
                      setSelectedUpsellService(service);
                      setAi((current) => ({
                        ...current,
                        recommended_action: selected.description,
                        upsell_pitch: selected.pitch,
                      }));
                    }}
                  >
                    <SelectTrigger id="report-recommendation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {report.selected_upsells.map((offer) => (
                        <SelectItem key={offer.service} value={offer.service}>
                          {offer.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {report.view_model ? (
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  <p className="font-medium">Rapportunderlag</p>
                  <p className="mt-1 text-muted-foreground">
                    Period {report.view_model.period.start}–{" "}
                    {report.view_model.period.end} ·{" "}
                    {report.view_model.coverage.available}/
                    {report.view_model.coverage.total} datakällor
                  </p>
                </div>
              ) : null}

              <div className="grid gap-3 border-t pt-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4" />
                  Mailtext (redigerbar)
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ai-greeting">Hälsning</Label>
                  <Input
                    id="ai-greeting"
                    value={ai.greeting}
                    onChange={(e) => setAi({ ...ai, greeting: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ai-summary">Sammanfattning</Label>
                  <Textarea
                    id="ai-summary"
                    rows={3}
                    value={ai.summary}
                    onChange={(e) => setAi({ ...ai, summary: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ai-action">Rekommenderad åtgärd</Label>
                  <Textarea
                    id="ai-action"
                    rows={2}
                    value={ai.recommended_action}
                    onChange={(e) =>
                      setAi({ ...ai, recommended_action: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ai-pitch">Motivering (upsell)</Label>
                  <Textarea
                    id="ai-pitch"
                    rows={2}
                    value={ai.upsell_pitch}
                    onChange={(e) =>
                      setAi({ ...ai, upsell_pitch: e.target.value })
                    }
                  />
                </div>
              </div>

              {report.generated_html && (
                <div className="grid gap-2 border-t pt-4">
                  <Label>Förhandsvisning (draft)</Label>
                  <iframe
                    title="Förhandsvisning av rapportmail"
                    srcDoc={report.generated_html}
                    className="w-full h-80 rounded-md border bg-white"
                  />
                  <p className="text-xs text-muted-foreground">
                    Förhandsvisningen visar den genererade draften. Dina
                    textändringar ovan tillämpas när du skickar.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {report && (
            <>
              {report.pdf_storage_path ? (
                <Button variant="outline" onClick={handleDownloadPdf}>
                  <Download className="h-4 w-4" />
                  Öppna PDF
                </Button>
              ) : null}
              {canSend ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Generera om
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={isSending || !recipientEmail}
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    {isSending ? "Skickar..." : "Skicka till kund"}
                  </Button>
                </>
              ) : (
                <Badge variant="outline">
                  {report.status === "sent"
                    ? "Rapporten är redan skickad"
                    : "Rapporten behandlas"}
                </Badge>
              )}
            </>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Stäng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
