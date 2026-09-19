import { useState } from "react";
import { useDataProvider, useNotify, useRefresh } from "ra-core";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Deal } from "../types";
import { isAtDecision } from "./recordOpportunityDecision";
import { recordYes } from "./recordSalesDecision";
import { removeFromPipeline } from "./removeFromPipeline";
import {
  canRemoveFromPipeline,
  DECLINED_EXIT_REASONS,
  findExitReason,
  GHOSTED_EXIT_REASON,
  PIPELINE_EXIT_REASONS,
  type PipelineExitReason,
} from "./pipelineExit";
import { PaymentPanel } from "./PaymentPanel";

// Every active Opportunity gets a way to finish, and a Decision-stage one
// gets the three answers a sales conversation actually produces.
//
// Before this, a Decision drawer showed Gil Lelli's whole context —
// attended, would work with, thinking, follow up Sep 22 — and offered no
// way to record what he decided. The Dashboard could say who was deciding
// and the board could show the column, and the only way out of either was
// to drag a card at a trash icon.
//
// Then there were two answers, Yes and No, and Ghosted sat inside No's
// reason list. That made silence a kind of declining, which it is not: one
// is a person telling you no, the other is a person telling you nothing,
// and only the second says anything about whether to write to them again.
// So Ghosted is its own button now, and No offers only the reasons a
// prospect can actually give.
export const OpportunityDecisionActions = ({ deal }: { deal: Deal }) => {
  const [removeOpen, setRemoveOpen] = useState(false);
  const removable = canRemoveFromPipeline(deal);

  if (!removable && deal.stage !== "won") return null;

  return (
    <div className="flex flex-col gap-3 mt-4">
      {isAtDecision(deal) && <YesNoActions deal={deal} />}
      {/* Payment is its own dimension: Won never implies paid, and an
          onboarded client can still owe a payment plan. */}
      {deal.stage === "won" && (
        <PaymentPanel
          opportunityId={deal.id}
          contactId={deal.contact_id}
          title="Payment"
        />
      )}

      {removable && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Finished with this one?</p>
              <p className="text-xs text-muted-foreground">
                Nothing is deleted — the person and their whole history stay.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemoveOpen(true)}
            >
              Remove from pipeline
            </Button>
          </CardContent>
        </Card>
      )}

      <RemoveFromPipelineDialog
        deal={deal}
        open={removeOpen}
        onOpenChange={setRemoveOpen}
      />
    </div>
  );
};

const YesNoActions = ({ deal }: { deal: Deal }) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  const [noOpen, setNoOpen] = useState(false);
  const [ghostedOpen, setGhostedOpen] = useState(false);

  const yes = async () => {
    setBusy(true);
    try {
      const result = await recordYes(dataProvider, { opportunityId: deal.id });
      if (result.status === "already-resolved") {
        notify("This Opportunity has already been resolved.", {
          type: "warning",
        });
      } else if (result.status === "not-found") {
        notify("ra.notification.http_error", { type: "error" });
      } else {
        // Won is a sales fact. Payment and onboarding are their own
        // dimensions and are shown separately, never implied by this.
        notify(
          "Recorded as Won. Payment and onboarding are tracked separately.",
          {
            type: "info",
          },
        );
      }
      refresh();
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Record decision</p>
            <p className="text-xs text-muted-foreground">What did they say?</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={yes} disabled={busy}>
              Yes
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setNoOpen(true)}
              disabled={busy}
            >
              No
            </Button>
            {/* Ghosted is a third answer, not a flavour of No. It is only
                ever a deliberate click: nothing infers it from elapsed
                time, a missed follow-up, a cancellation or a no-show. */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setGhostedOpen(true)}
              disabled={busy}
            >
              Ghosted
            </Button>
          </div>
        </CardContent>
      </Card>

      <RemoveFromPipelineDialog
        deal={deal}
        open={noOpen}
        onOpenChange={setNoOpen}
        title="They said no"
        description="What did they say no to? This removes them from the active pipeline and keeps their history."
        reasons={DECLINED_EXIT_REASONS}
        confirmLabel="Record their answer"
      />

      <GhostedDialog
        deal={deal}
        open={ghostedOpen}
        onOpenChange={setGhostedOpen}
      />
    </>
  );
};

/**
 * Recording that somebody went quiet.
 *
 * Deliberately its own dialog rather than a reason inside "They said no".
 * Ghosting is not a decision the prospect communicated — it is Leif
 * deciding the attempt is over because they stopped replying — and the
 * two need to stay tellable apart months later.
 *
 * It ends the attempt through the same canonical path as every other
 * exit: outcome 'lost', exit_reason 'ghosted', prospect_decision
 * 'ghosted', a Ghosted tag on the Contact, a note in the Deal's history,
 * and the follow-up Tasks closed. Nothing is deleted or archived.
 */
const GhostedDialog = ({
  deal,
  open,
  onOpenChange,
}: {
  deal: Deal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const result = await removeFromPipeline(dataProvider, {
        opportunityId: deal.id,
        reason: GHOSTED_EXIT_REASON,
        note,
      });
      if (result.status === "removed") {
        notify("Recorded as Ghosted. Their history stays exactly as it is.", {
          type: "info",
        });
        onOpenChange(false);
      } else if (result.status === "already-resolved") {
        notify("This Opportunity has already been resolved.", {
          type: "warning",
        });
        onOpenChange(false);
      } else {
        notify("ra.notification.http_error", { type: "error" });
      }
      refresh();
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>They stopped replying</DialogTitle>
          <DialogDescription>
            This ends the sales attempt and tags the contact as Ghosted. Nothing
            is deleted — the person, their application and their calls all stay.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1">
          <Label htmlFor="ghosted-note" className="text-sm">
            Note (optional)
          </Label>
          <Input
            id="ghosted-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Anything worth keeping"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={busy}>
            Record as Ghosted
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const RemoveFromPipelineDialog = ({
  deal,
  open,
  onOpenChange,
  title = "Remove from pipeline",
  description = "Why is this ending? Nothing is deleted — the person and their history stay exactly as they are.",
  // Which reasons this particular dialog offers. Defaults to all of them;
  // the No button narrows it to the answers a prospect can actually give,
  // so "they said no" never quietly covers ghosting or a nurture decision.
  reasons,
  confirmLabel = "Remove from pipeline",
}: {
  deal: Deal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  reasons?: readonly PipelineExitReason[];
  confirmLabel?: string;
}) => {
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();
  const [reason, setReason] = useState<PipelineExitReason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const options = reasons
    ? reasons.map((r) => findExitReason(r))
    : PIPELINE_EXIT_REASONS;
  const definition = options.find((r) => r.reason === reason);
  const noteRequired = Boolean(definition?.requiresNote);
  const canSubmit =
    reason != null && (!noteRequired || note.trim().length > 0) && !busy;

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      const result = await removeFromPipeline(dataProvider, {
        opportunityId: deal.id,
        reason,
        note,
      });
      if (result.status === "removed") {
        notify(`Removed from pipeline — ${definition?.label}.`, {
          type: "info",
        });
        onOpenChange(false);
      } else if (result.status === "note-required") {
        notify("Say what happened in a sentence.", { type: "warning" });
      } else if (result.status === "already-resolved") {
        notify("This Opportunity has already been resolved.", {
          type: "warning",
        });
        onOpenChange(false);
      } else {
        notify("ra.notification.http_error", { type: "error" });
      }
      refresh();
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={reason ?? ""}
          onValueChange={(value) => setReason(value as PipelineExitReason)}
          className="gap-2"
        >
          {options.map((option) => (
            <div key={option.reason} className="flex items-start gap-2">
              <RadioGroupItem
                value={option.reason}
                id={`exit-${option.reason}`}
                className="mt-1"
              />
              <Label
                htmlFor={`exit-${option.reason}`}
                className="flex flex-col items-start gap-0.5 font-normal cursor-pointer"
              >
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.help}
                </span>
              </Label>
            </div>
          ))}
        </RadioGroup>

        {reason != null && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="exit-note" className="text-sm">
              {noteRequired ? "What happened?" : "Note (optional)"}
            </Label>
            <Input
              id="exit-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={
                noteRequired ? "A sentence is enough" : "Anything worth keeping"
              }
            />
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={!canSubmit}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
