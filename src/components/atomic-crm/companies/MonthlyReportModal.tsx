import { useState } from "react";
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
import { Loader2, Mail, Sparkles } from "lucide-react";

import type { Company, MonthlyReport, ReportAiContent } from "../types";
import type { CrmDataProvider } from "../providers/supabase/dataProvider";

/**
 * Månadsrapport-modal: generera draft → granska/redigera → skicka till kund.
 * Speglar CallLogFollowupModal. Edge-funktionen bygger om mail-HTML från
 * redigerad AI-text vid utskick (single source of truth).
 */
export const MonthlyReportModal = ({
  company,
  open,
  onOpenChange,
  onSent,
}: {
  company: Company;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}) => {
  const dataProvider = useDataProvider() as CrmDataProvider;
  const notify = useNotify();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [ai, setAi] = useState<ReportAiContent>({
    greeting: "",
    summary: "",
    recommended_action: "",
    upsell_pitch: "",
  });

  const loadReport = async (reportId: number) => {
    const { data } = await dataProvider.getOne<MonthlyReport>(
      "monthly_reports",
      { id: reportId },
    );
    setReport(data);
    setRecipientEmail(data.recipient_email ?? "");
    if (data.ai_content) setAi(data.ai_content);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await dataProvider.generateMonthlyReport(company.id);
      if (!result.report_id || result.status.startsWith("skipped")) {
        notify(
          result.status === "skipped_no_snapshot"
            ? "Ingen hemsidestatistik ännu — kör 'Uppdatera statistik' först."
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

  const upsell = report?.selected_upsells?.[0];

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
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-sm text-muted-foreground text-center">
                Skapar en rapport från senaste hemsidestatistiken med trend och
                ett skräddarsytt förslag — som du kan granska och redigera innan
                den skickas.
              </p>
              <Button onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isGenerating ? "Genererar (~15 s)..." : "Generera draft"}
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
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Stäng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
