import { useCallback, useEffect, useState } from "react";
import { useDataProvider, useNotify, useTranslate } from "ra-core";
import type { Identifier } from "ra-core";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { formatWindowWeekLabel } from "./cadenceWeekLabel";
import { formatMonthDayString } from "../deals/dealUtils";
import type { ClientSessionCadenceClassification } from "../types";
import type { CadenceIssueResolutionContext } from "./loadCadenceIssueResolutionContext";
import { loadCadenceIssueResolutionContext } from "./loadCadenceIssueResolutionContext";
import {
  reopenCadenceIssue,
  setCadenceIssueClassification,
} from "./resolveClientSessionCadenceIssue";

// Client + Session Operations, resolution UX correction: the ONE shared
// resolution component — a modal/lightbox over whatever page opened it,
// never a separate full-page workflow. Two entry points render it, never
// two implementations: ClientShow opens it as local dialog state (stays
// on /enrollments/:id/show, same scroll/context throughout); the
// /client-session-cadence/:id/resolve route (what a Dashboard/Task-row
// Resolve click still navigates to) is a thin wrapper around this same
// component that closes by going back in browser history — so "Dashboard
// → Resolve → close" lands back on the real Dashboard. Same durable
// client_session_cadence_issues row, same functions
// (setCadenceIssueClassification/reopenCadenceIssue) either way.
//
// The three classifications are Leif's own explicit decision; nothing
// here ever guesses which one applies (Atomic handles certainty, Leif
// handles ambiguity). A classification is a human judgment, never
// immutable — every button stays available even once resolved (clicking
// a DIFFERENT one reclassifies), and "Clear decision" clears it entirely
// for a judgment made by mistake, returning the issue (and Needs
// Attention, on both this client's page and the Dashboard) to
// unresolved. Escape/X/overlay-click all close it via the Dialog
// primitive's own onOpenChange — no bespoke modal/focus-trap logic here.
const classificationLabels: Record<ClientSessionCadenceClassification, string> =
  {
    known_skip: "Known skip",
    rescheduled: "Rescheduled",
    missed_ghosted: "Missed / ghosted",
  };

const ALL_CLASSIFICATIONS: ClientSessionCadenceClassification[] = [
  "known_skip",
  "rescheduled",
  "missed_ghosted",
];

export const CadenceResolutionModal = ({
  cadenceIssueId,
  onOpenChange,
  onChange,
}: {
  // null closes the dialog — the same prop doubles as both "which issue"
  // and "is it open".
  cadenceIssueId: Identifier | null;
  onOpenChange: (open: boolean) => void;
  // Called after every successful classify/clear, so a host page holding
  // its own cached cadence data (ClientShow) knows to refresh — never
  // required, since the modal's own display always reflects the latest
  // state regardless.
  onChange?: () => void;
}) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const translate = useTranslate();
  const [context, setContext] = useState<
    CadenceIssueResolutionContext | "pending"
  >("pending");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    if (cadenceIssueId == null) return;
    const result = await loadCadenceIssueResolutionContext(
      dataProvider,
      cadenceIssueId,
    );
    setContext(result);
  }, [dataProvider, cadenceIssueId]);

  useEffect(() => {
    if (cadenceIssueId == null) return;
    setContext("pending");
    setNote("");
    load();
  }, [cadenceIssueId, load]);

  const handleClassify = async (
    classification: ClientSessionCadenceClassification,
  ) => {
    if (cadenceIssueId == null) return;
    setBusy(true);
    try {
      const result = await setCadenceIssueClassification(dataProvider, {
        cadenceIssueId,
        classification,
        note,
      });
      if (result.status === "not-found") {
        notify("resources.enrollments.cadence.not_found", {
          type: "warning",
          _: "This item no longer exists.",
        });
      }
      await load();
      onChange?.();
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    if (cadenceIssueId == null) return;
    setBusy(true);
    try {
      await reopenCadenceIssue(dataProvider, { cadenceIssueId });
      await load();
      onChange?.();
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={cadenceIssueId != null} onOpenChange={onOpenChange}>
      {cadenceIssueId != null && (
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {translate("resources.enrollments.cadence.modal_title", {
                _: "What happened this week?",
              })}
            </DialogTitle>
          </DialogHeader>

          {context === "pending" ? null : context.kind === "not-found" ? (
            <p className="text-sm text-muted-foreground">
              {translate("resources.enrollments.cadence.not_found", {
                _: "This item no longer exists.",
              })}
            </p>
          ) : (
            <ResolutionForm
              context={context}
              busy={busy}
              note={note}
              onNoteChange={setNote}
              onClassify={handleClassify}
              onClear={handleClear}
            />
          )}
        </DialogContent>
      )}
    </Dialog>
  );
};

const ResolutionForm = ({
  context,
  busy,
  note,
  onNoteChange,
  onClassify,
  onClear,
}: {
  context: Extract<CadenceIssueResolutionContext, { kind: "found" }>;
  busy: boolean;
  note: string;
  onNoteChange: (note: string) => void;
  onClassify: (classification: ClientSessionCadenceClassification) => void;
  onClear: () => void;
}) => {
  const translate = useTranslate();
  const { slot, issue, noShowSession } = context;
  const weekLabel = formatWindowWeekLabel(slot);
  const isResolved = issue.resolved_at != null && issue.classification != null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {weekLabel} ·{" "}
        {noShowSession
          ? translate("resources.enrollments.cadence.session_marked_no_show", {
              _: "%{date} session marked no-show",
              date: formatMonthDayString(
                noShowSession.scheduled_at.slice(0, 10),
              ),
            })
          : translate("resources.enrollments.cadence.no_session_booked", {
              _: "No session booked",
            })}
      </p>

      {isResolved && issue.classification ? (
        <p className="text-sm font-medium">
          {translate("resources.enrollments.cadence.currently", {
            _: "Currently: %{classification}",
            classification: classificationLabels[issue.classification],
          })}
        </p>
      ) : (
        <Textarea
          placeholder={translate(
            "resources.enrollments.cadence.note_placeholder",
            { _: "Note (optional)" },
          )}
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      )}

      <div className="flex flex-col gap-2">
        {ALL_CLASSIFICATIONS.map((classification) => (
          <Button
            key={classification}
            variant={
              issue.classification === classification ? "default" : "outline"
            }
            disabled={busy}
            onClick={() => onClassify(classification)}
          >
            {classificationLabels[classification]}
            {issue.classification === classification ? " ✓" : ""}
          </Button>
        ))}
      </div>

      {isResolved && (
        <div className="border-t pt-3">
          <Button variant="ghost" disabled={busy} onClick={onClear}>
            {translate("resources.enrollments.cadence.clear_decision", {
              _: "Clear decision",
            })}
          </Button>
        </div>
      )}
    </div>
  );
};
