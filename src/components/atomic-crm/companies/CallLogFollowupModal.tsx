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
import { Copy, Loader2, Mail, MessageSquare, Sparkles } from "lucide-react";

import type { CallLog } from "../types";
import type { CrmDataProvider } from "../providers/supabase/dataProvider";

type Draft = {
  email_subject: string;
  email_body: string;
  sms_text: string;
  contact_id: number | null;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
};

export const CallLogFollowupModal = ({
  log,
  open,
  onOpenChange,
}: {
  log: CallLog;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const dataProvider = useDataProvider() as CrmDataProvider;
  const notify = useNotify();

  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [smsText, setSmsText] = useState("");

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const result = await dataProvider.generateFollowupMessage(log.id);
      setDraft(result);
      setSubject(result.email_subject);
      setEmailBody(result.email_body);
      setSmsText(result.sms_text);
    } catch (error) {
      notify(
        `Fel: ${error instanceof Error ? error.message : "Kunde inte generera utkast"}`,
        { type: "error" },
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!draft?.contact_id) {
      notify("Kontakten saknar e-postadress — kan inte skicka", {
        type: "warning",
      });
      return;
    }
    setIsSending(true);
    try {
      await dataProvider.sendFollowupEmail({
        contact_id: draft.contact_id,
        subject,
        body: emailBody,
      });
      notify(`Mejl skickat till ${draft.contact_email}`, { type: "success" });
      onOpenChange(false);
    } catch (error) {
      notify(
        `Fel: ${error instanceof Error ? error.message : "Kunde inte skicka mejl"}`,
        { type: "error" },
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleCopySms = async () => {
    try {
      await navigator.clipboard.writeText(smsText);
      notify("SMS-text kopierad", { type: "info" });
    } catch {
      notify("Kunde inte kopiera till urklipp", { type: "error" });
    }
  };

  const canSendEmail = Boolean(draft?.contact_email);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] grid-rows-[auto_1fr_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Generera uppföljning</DialogTitle>
          <DialogDescription>
            AI-utkast på mejl och SMS baserat på samtalsanteckningarna.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto min-h-0 pr-1">
          {!draft ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-sm text-muted-foreground text-center">
                Skapa ett förslag på mejl och SMS som du kan granska, redigera
                och skicka.
              </p>
              <Button onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {isGenerating ? "Genererar..." : "Generera utkast"}
              </Button>
            </div>
          ) : (
            <div className="grid gap-5 py-4">
              {/* Email */}
              <div className="grid gap-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4" />
                  Mejl
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="followup-subject">Ämne</Label>
                  <Input
                    id="followup-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="followup-body">Meddelande</Label>
                  <Textarea
                    id="followup-body"
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    rows={8}
                  />
                </div>
                {!canSendEmail && (
                  <p className="text-xs text-orange-600">
                    Kontakten saknar e-postadress — mejlet kan inte skickas
                    härifrån.
                  </p>
                )}
                <div className="flex justify-end">
                  <Button
                    onClick={handleSendEmail}
                    disabled={isSending || !canSendEmail}
                    size="sm"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    {isSending
                      ? "Skickar..."
                      : draft.contact_email
                        ? `Skicka till ${draft.contact_email}`
                        : "Skicka via mejl"}
                  </Button>
                </div>
              </div>

              {/* SMS */}
              <div className="grid gap-3 border-t pt-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="h-4 w-4" />
                  SMS
                  {draft.contact_phone && (
                    <span className="text-xs font-normal text-muted-foreground">
                      ({draft.contact_phone})
                    </span>
                  )}
                </div>
                <Textarea
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  {smsText.length} tecken — kopiera och skicka manuellt.
                </p>
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={handleCopySms}>
                    <Copy className="h-4 w-4" />
                    Kopiera SMS
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {draft && (
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
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Stäng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
