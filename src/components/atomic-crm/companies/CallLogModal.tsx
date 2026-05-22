import { useState } from "react";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRefresh,
} from "ra-core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone } from "lucide-react";
import type { CallLog, Company } from "../types";
import type { CrmDataProvider } from "../providers/supabase/dataProvider";

const outcomeOptions: { value: CallLog["call_outcome"]; label: string }[] = [
  { value: "hot_lead", label: "\u{1F525} Heta leads" },
  { value: "active_customer", label: "Aktiva kunder" },
  { value: "under_negotiation", label: "Under förhandling" },
  { value: "follow_up", label: "Att följa upp" },
  { value: "never_contacted", label: "Aldrig kontaktade" },
  { value: "contacted_no_response", label: "Kontaktade, inget svar" },
  { value: "not_interested", label: "Inte intresserade" },
];

export const CallLogModal = () => {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<CallLog["call_outcome"]>("none");
  const [notes, setNotes] = useState("");
  const [followupDate, setFollowupDate] = useState("");
  const [followupNote, setFollowupNote] = useState("");
  const [isPending, setIsPending] = useState(false);

  const company = useRecordContext<Company>();
  const dataProvider = useDataProvider() as CrmDataProvider;
  const notify = useNotify();
  const refresh = useRefresh();

  const handleSubmit = async () => {
    if (!company?.id) return;

    setIsPending(true);
    try {
      const followupTimestamp = followupDate
        ? new Date(followupDate).toISOString()
        : null;

      await dataProvider.logCall({
        company_id: Number(company.id),
        call_outcome: outcome,
        notes: notes || null,
        followup_date: followupTimestamp,
        followup_note: followupNote || null,
      });

      // RPC function handles lead_status update — no need to update manually

      notify("Samtalslogg sparad", { type: "success" });
      refresh();
      setOpen(false);
      setOutcome("none");
      setNotes("");
      setFollowupDate("");
      setFollowupNote("");
    } catch (error) {
      notify(
        `Fel: ${error instanceof Error ? error.message : "Kunde inte spara samtalslogg"}`,
        { type: "error" },
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Phone className="h-4 w-4" />
          Logga samtal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] grid-rows-[auto_1fr_auto] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Logga samtal</DialogTitle>
          <DialogDescription>
            Registrera ett samtal med {company?.name}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto min-h-0 pr-1">
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="outcome">Resultat</Label>
              <Select
                value={outcome === "none" ? undefined : outcome}
                onValueChange={(value) =>
                  setOutcome(value as CallLog["call_outcome"])
                }
              >
                <SelectTrigger id="outcome">
                  <SelectValue placeholder="Välj resultat (valfritt)..." />
                </SelectTrigger>
                <SelectContent>
                  {outcomeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Anteckningar</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Vad hände under samtalet?"
                rows={4}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="followup_date">Uppföljningsdatum och tid</Label>
              <input
                id="followup_date"
                type="datetime-local"
                value={followupDate}
                onChange={(e) => setFollowupDate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {followupDate && (
              <div className="grid gap-2">
                <Label htmlFor="followup_note">Uppföljningsnotering</Label>
                <Textarea
                  id="followup_note"
                  value={followupNote}
                  onChange={(e) => setFollowupNote(e.target.value)}
                  placeholder="Vad ska göras vid uppföljningen?"
                  rows={2}
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Sparar..." : "Spara"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
