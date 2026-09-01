import { addDays } from "date-fns/addDays";
import { useState } from "react";
import {
  useDataProvider,
  useNotify,
  useRefresh,
  useTranslate,
  type Identifier,
} from "ra-core";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import {
  ownerDecisions,
  prospectDecisions,
} from "../deals/opportunityConstants";
import type {
  OpportunityOwnerDecision,
  OpportunityProspectDecision,
  SalesCallAttendance,
} from "../types";
import {
  DEFAULT_THINKING_FOLLOW_UP_DAYS,
  salesCallAttendances,
} from "./salesCallConstants";
import { completeSalesCallOutcome } from "./completeSalesCallOutcome";

const defaultFollowUpDate = () =>
  addDays(new Date(), DEFAULT_THINKING_FOLLOW_UP_DAYS)
    .toISOString()
    .split("T")[0];

// The one human-facing action this slice adds: "Complete Sales Call"
// (Acuity/Sales Call Lifecycle slice — see this slice's report for why a
// single progressively-revealed form, not a multi-step wizard, matches
// this app's existing conditional-section convention, e.g. deals/
// DealInputs.tsx's own DealSalesProcessInputs). Every field maps directly
// onto the SAME owner_decision/prospect_decision/follow_up_date fields
// DealInputs.tsx already edits — this is a guided front door onto them,
// not a second representation. A single call to
// completeSalesCallOutcome.ts on submit; this component owns none of the
// business logic itself.
export const CompleteSalesCallDialog = ({
  open,
  onOpenChange,
  salesCallId,
  contactName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesCallId: Identifier;
  contactName: string;
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const refresh = useRefresh();

  const [attendance, setAttendance] = useState<SalesCallAttendance | null>(
    null,
  );
  const [ownerDecision, setOwnerDecision] =
    useState<OpportunityOwnerDecision | null>(null);
  const [prospectDecision, setProspectDecision] =
    useState<OpportunityProspectDecision | null>(null);
  const [followUpDate, setFollowUpDate] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setAttendance(null);
    setOwnerDecision(null);
    setProspectDecision(null);
    setFollowUpDate("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const canSubmit =
    attendance === "no_show" ||
    (attendance === "attended" &&
      ownerDecision != null &&
      (ownerDecision !== "would_work_with" ||
        (prospectDecision != null &&
          (prospectDecision !== "thinking" || !!followUpDate))));

  const handleSubmit = async () => {
    if (!attendance || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await completeSalesCallOutcome({
        dataProvider,
        salesCallId,
        contactName,
        attendance,
        ownerDecision,
        prospectDecision,
        followUpDate: prospectDecision === "thinking" ? followUpDate : null,
      });

      if (result.status === "completed") {
        notify("resources.deals.sales_call.completed", {
          type: "info",
          _: "Sales call completed.",
        });
        handleOpenChange(false);
        refresh();
      } else if (result.status === "already-completed") {
        notify("resources.deals.sales_call.already_completed", {
          type: "warning",
          _: "This call's outcome was already recorded.",
        });
        handleOpenChange(false);
        refresh();
      } else {
        notify("ra.notification.http_error", { type: "error" });
      }
    } catch {
      notify("ra.notification.http_error", { type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {translate("resources.deals.sales_call.complete_title", {
              _: "Complete Sales Call",
            })}
          </DialogTitle>
          <DialogDescription>
            {translate("resources.deals.sales_call.complete_description", {
              _: "%{name}'s sales call",
              name: contactName,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <Label className="text-sm font-medium">
              {translate("resources.deals.sales_call.attendance", {
                _: "Attendance",
              })}
            </Label>
            <RadioGroup
              value={attendance ?? undefined}
              onValueChange={(value) =>
                setAttendance(value as SalesCallAttendance)
              }
            >
              {salesCallAttendances.map((choice) => (
                <div key={choice.value} className="flex items-center gap-2">
                  <RadioGroupItem
                    value={choice.value}
                    id={`attendance-${choice.value}`}
                  />
                  <Label
                    htmlFor={`attendance-${choice.value}`}
                    className="font-normal"
                  >
                    {choice.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </fieldset>

          {attendance === "attended" && (
            <fieldset className="flex flex-col gap-3 rounded-lg border p-4">
              <Label className="text-sm font-medium">
                {translate("resources.deals.sales_call.owner_fit_question", {
                  _: "Would I work with this person?",
                })}
              </Label>
              <RadioGroup
                value={ownerDecision ?? undefined}
                onValueChange={(value) => {
                  setOwnerDecision(value as OpportunityOwnerDecision);
                  setProspectDecision(null);
                }}
              >
                {ownerDecisions.map((choice) => (
                  <div key={choice.value} className="flex items-center gap-2">
                    <RadioGroupItem
                      value={choice.value}
                      id={`owner-${choice.value}`}
                    />
                    <Label
                      htmlFor={`owner-${choice.value}`}
                      className="font-normal"
                    >
                      {choice.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              {ownerDecision === "would_work_with" && (
                <div className="flex flex-col gap-3 rounded-lg border p-4 mt-2">
                  <Label className="text-sm font-medium">
                    {translate(
                      "resources.deals.sales_call.prospect_decision_question",
                      { _: "Their decision" },
                    )}
                  </Label>
                  <RadioGroup
                    value={prospectDecision ?? undefined}
                    onValueChange={(value) => {
                      const next = value as OpportunityProspectDecision;
                      setProspectDecision(next);
                      if (next === "thinking" && !followUpDate) {
                        setFollowUpDate(defaultFollowUpDate());
                      }
                    }}
                  >
                    {prospectDecisions.map((choice) => (
                      <div
                        key={choice.value}
                        className="flex items-center gap-2"
                      >
                        <RadioGroupItem
                          value={choice.value}
                          id={`prospect-${choice.value}`}
                        />
                        <Label
                          htmlFor={`prospect-${choice.value}`}
                          className="font-normal"
                        >
                          {choice.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>

                  {prospectDecision === "thinking" && (
                    <div className="flex flex-col gap-2 mt-2">
                      <Label
                        htmlFor="follow-up-date"
                        className="text-sm font-medium"
                      >
                        {translate("resources.deals.sales_call.follow_up_on", {
                          _: "Follow up on",
                        })}
                      </Label>
                      <Input
                        id="follow-up-date"
                        type="date"
                        value={followUpDate}
                        onChange={(event) =>
                          setFollowUpDate(event.target.value)
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            </fieldset>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            {translate("ra.action.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {translate("resources.deals.sales_call.complete_action", {
              _: "Complete Sales Call",
            })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
