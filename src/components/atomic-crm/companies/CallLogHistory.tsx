import { useEffect, useState } from "react";
import {
  useDelete,
  useGetList,
  useNotify,
  useRecordContext,
  useUpdate,
} from "ra-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  CircleX,
  Edit,
  Phone,
  Save,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import type { CallLog, Company } from "../types";
import { supabase } from "../providers/supabase/supabase";
import { CallLogFollowupModal } from "./CallLogFollowupModal";

// Labels for ALL outcomes (current 7 Relationsstatus + legacy) so historical data displays correctly
const outcomeLabels: Record<CallLog["call_outcome"], string> = {
  // Current 7 Relationsstatus outcomes
  none: "Inget resultat",
  hot_lead: "\u{1F525} Heta leads",
  active_customer: "Aktiva kunder",
  under_negotiation: "Under förhandling",
  follow_up: "Att följa upp",
  never_contacted: "Aldrig kontaktade",
  contacted_no_response: "Kontaktade, inget svar",
  not_interested: "Inte intresserade",
  // Legacy outcomes
  no_answer: "Inget svar",
  busy: "Upptaget",
  wrong_number: "Fel nummer",
  spoke_gatekeeper: "Pratade med receptionist",
  spoke_decision_maker: "Pratade med beslutsfattare",
  interested: "Intresserad",
  meeting_booked: "Möte bokat",
  send_info: "Skicka info",
  callback_requested: "Ring upp igen",
};

const outcomeVariants: Record<
  CallLog["call_outcome"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  // Current 7 Relationsstatus
  none: "secondary",
  hot_lead: "default",
  active_customer: "default",
  under_negotiation: "outline",
  follow_up: "outline",
  never_contacted: "secondary",
  contacted_no_response: "secondary",
  not_interested: "destructive",
  // Legacy
  no_answer: "secondary",
  busy: "secondary",
  wrong_number: "destructive",
  spoke_gatekeeper: "outline",
  spoke_decision_maker: "default",
  interested: "default",
  meeting_booked: "default",
  send_info: "outline",
  callback_requested: "outline",
};

// Only current 7 Relationsstatus options shown in edit dropdown
const outcomeOptions: { value: CallLog["call_outcome"]; label: string }[] = [
  { value: "hot_lead", label: "\u{1F525} Heta leads" },
  { value: "active_customer", label: "Aktiva kunder" },
  { value: "under_negotiation", label: "Under förhandling" },
  { value: "follow_up", label: "Att följa upp" },
  { value: "never_contacted", label: "Aldrig kontaktade" },
  { value: "contacted_no_response", label: "Kontaktade, inget svar" },
  { value: "not_interested", label: "Inte intresserade" },
];

export const CallLogHistory = () => {
  const company = useRecordContext<Company>();

  const { data: callLogs, isPending } = useGetList<CallLog>("call_logs", {
    filter: { company_id: company?.id },
    sort: { field: "created_at", order: "DESC" },
    pagination: { page: 1, perPage: 10 },
  });

  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Samtalshistorik</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Laddar...</p>
        </CardContent>
      </Card>
    );
  }

  if (!callLogs || callLogs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Samtalshistorik</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Inga samtal registrerade än.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Samtalshistorik</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {callLogs.map((log) => (
            <CallLogItem key={log.id} log={log} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const CallLogItem = ({ log }: { log: CallLog }) => {
  const [salesName, setSalesName] = useState<string>("");
  const [isHover, setHover] = useState(false);
  const [isEditing, setEditing] = useState(false);
  const [showFollowup, setShowFollowup] = useState(false);
  const [outcome, setOutcome] = useState<CallLog["call_outcome"]>(
    log.call_outcome,
  );
  const [notes, setNotes] = useState(log.notes ?? "");
  const [followupDate, setFollowupDate] = useState(log.followup_date ?? "");
  const [followupNote, setFollowupNote] = useState(log.followup_note ?? "");
  const notify = useNotify();
  const [update, { isPending: isUpdating }] = useUpdate();
  const [deleteCallLog, { isPending: isDeleting }] = useDelete(
    "call_logs",
    undefined,
    {
      mutationMode: "undoable",
      onSuccess: () => {
        notify("Samtalslogg borttagen", {
          type: "info",
          undoable: true,
        });
      },
    },
  );

  useEffect(() => {
    const fetchSalesName = async () => {
      if (!log.user_id) return;

      const { data } = await supabase
        .from("sales")
        .select("first_name, last_name")
        .eq("user_id", log.user_id)
        .single();

      if (data) {
        setSalesName(`${data.first_name} ${data.last_name}`);
      }
    };

    fetchSalesName();
  }, [log.user_id]);

  useEffect(() => {
    setOutcome(log.call_outcome);
    setNotes(log.notes ?? "");
    // Convert ISO timestamp to datetime-local format (YYYY-MM-DDTHH:MM)
    const followupDatetime = log.followup_date
      ? new Date(log.followup_date).toISOString().slice(0, 16)
      : "";
    setFollowupDate(followupDatetime);
    setFollowupNote(log.followup_note ?? "");
  }, [log]);

  const handleCancelEdit = () => {
    setOutcome(log.call_outcome);
    setNotes(log.notes ?? "");
    // Convert ISO timestamp to datetime-local format (YYYY-MM-DDTHH:MM)
    const followupDatetime = log.followup_date
      ? new Date(log.followup_date).toISOString().slice(0, 16)
      : "";
    setFollowupDate(followupDatetime);
    setFollowupNote(log.followup_note ?? "");
    setEditing(false);
    setHover(false);
  };

  const handleUpdate = () => {
    // Convert datetime-local string to ISO timestamp if followupDate exists
    const followupTimestamp = followupDate
      ? new Date(followupDate).toISOString()
      : null;

    update(
      "call_logs",
      {
        id: log.id,
        data: {
          call_outcome: outcome,
          notes: notes || null,
          followup_date: followupTimestamp,
          followup_note: followupTimestamp ? followupNote || null : null,
        },
        previousData: log,
      },
      {
        onSuccess: () => {
          notify("Samtalslogg uppdaterad", { type: "success" });
          setEditing(false);
          setHover(false);
        },
        onError: (error) => {
          notify(`Fel: ${error.message}`, { type: "error" });
        },
      },
    );
  };

  const handleDelete = () => {
    deleteCallLog("call_logs", { id: log.id, previousData: log });
  };

  return (
    <div
      className="border-l-2 border-muted pl-4 pb-4"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-center justify-between mb-2 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
          {log.call_outcome !== "none" && (
            <Badge variant={outcomeVariants[log.call_outcome]}>
              {outcomeLabels[log.call_outcome]}
            </Badge>
          )}
          <div
            className={`${isHover || isEditing ? "visible" : "invisible"} flex items-center gap-1`}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1"
              onClick={() => setEditing((current) => !current)}
              disabled={isUpdating || isDeleting}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1"
              title="Generera uppföljning (mejl/SMS)"
              onClick={() => setShowFollowup(true)}
              disabled={isUpdating || isDeleting}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1"
              onClick={handleDelete}
              disabled={isUpdating || isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {new Date(log.created_at).toLocaleString("sv-SE", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {isEditing ? (
        <div className="grid gap-3 pt-1">
          <div className="grid gap-2">
            <Label htmlFor={`outcome-${log.id}`}>Resultat</Label>
            <Select
              value={outcome === "none" ? undefined : outcome}
              onValueChange={(value) =>
                setOutcome(value as CallLog["call_outcome"])
              }
            >
              <SelectTrigger id={`outcome-${log.id}`}>
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
            <Label htmlFor={`notes-${log.id}`}>Anteckningar</Label>
            <Textarea
              id={`notes-${log.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Vad hände under samtalet?"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`followup-date-${log.id}`}>
              Uppföljningsdatum och tid
            </Label>
            <input
              id={`followup-date-${log.id}`}
              type="datetime-local"
              value={followupDate}
              onChange={(e) => setFollowupDate(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {followupDate && (
            <div className="grid gap-2">
              <Label htmlFor={`followup-note-${log.id}`}>
                Uppföljningsnotering
              </Label>
              <Textarea
                id={`followup-note-${log.id}`}
                value={followupNote}
                onChange={(e) => setFollowupNote(e.target.value)}
                rows={2}
                placeholder="Vad ska göras vid uppföljningen?"
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={handleCancelEdit}
              disabled={isUpdating}
            >
              <CircleX className="h-4 w-4" />
              Avbryt
            </Button>
            <Button type="button" onClick={handleUpdate} disabled={isUpdating}>
              <Save className="h-4 w-4" />
              {isUpdating ? "Sparar..." : "Spara"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {log.notes && (
            <p className="text-sm text-muted-foreground mb-2">{log.notes}</p>
          )}

          {log.followup_date && (
            <div className="flex items-center gap-1 text-sm text-orange-600 mb-1">
              <Calendar className="h-3 w-3" />
              <span>
                Följ upp:{" "}
                {new Date(log.followup_date).toLocaleString("sv-SE", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}

          {log.followup_note && (
            <p className="text-xs text-muted-foreground italic ml-4">
              {log.followup_note}
            </p>
          )}

          {salesName && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
              <User className="h-3 w-3" />
              <span>{salesName}</span>
            </div>
          )}
        </>
      )}

      <CallLogFollowupModal
        log={log}
        open={showFollowup}
        onOpenChange={setShowFollowup}
      />
    </div>
  );
};
