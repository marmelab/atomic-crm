import { useState } from "react";
import { CreateBase, Form, useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SaveButton } from "@/components/admin/form";

import { CohortInputs } from "../cohorts/CohortInputs";
import { OfferInputs } from "../offers/OfferInputs";
import type { Offer, OfferType } from "../types";

type Step =
  | { kind: "choose_type" }
  | { kind: "offer_form"; type: OfferType }
  | { kind: "cohort_form"; offer: Offer };

// "+ New Program" (§7 of the Programs + Opportunity UX slice): a clean
// choice between a 1:1 program and a group program, then just enough form
// to set it up — no DB terminology ("Offer"/"Cohort") shown to the user,
// and no wizard beyond what a Group program genuinely needs (its Offer,
// then its first Cohort).
export const NewProgramDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const translate = useTranslate();
  const [step, setStep] = useState<Step>({ kind: "choose_type" });

  const handleClose = () => {
    onOpenChange(false);
    // Reset after the close animation finishes so the dialog doesn't flash
    // back to step 1 while it's fading out.
    setTimeout(() => setStep({ kind: "choose_type" }), 200);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>
          {translate("crm.programs.new_program_title", { _: "New Program" })}
        </DialogTitle>

        {step.kind === "choose_type" && (
          <div className="flex flex-col gap-3 pt-2">
            <p className="text-sm text-muted-foreground">
              {translate("crm.programs.new_program_choose", {
                _: "How do you work with clients in this program?",
              })}
            </p>
            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-1 p-4 whitespace-normal"
              onClick={() =>
                setStep({ kind: "offer_form", type: "individual" })
              }
            >
              <span className="font-medium">
                {translate("crm.programs.one_on_one_program", {
                  _: "1:1 Program",
                })}
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                {translate("crm.programs.one_on_one_program_hint", {
                  _: "Ongoing individual coaching, like The Living Example.",
                })}
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-1 p-4 whitespace-normal"
              onClick={() => setStep({ kind: "offer_form", type: "group" })}
            >
              <span className="font-medium">
                {translate("crm.programs.group_program", {
                  _: "Group Program",
                })}
              </span>
              <span className="text-xs text-muted-foreground font-normal">
                {translate("crm.programs.group_program_hint", {
                  _: "A cohort-based program, like Growing Yourself Up.",
                })}
              </span>
            </Button>
          </div>
        )}

        {step.kind === "offer_form" && (
          <CreateBase
            resource="offers"
            redirect={false}
            mutationOptions={{
              onSuccess: (offer: Offer) => {
                if (offer.type === "group") {
                  setStep({ kind: "cohort_form", offer });
                } else {
                  handleClose();
                }
              },
            }}
          >
            <Form defaultValues={{ type: step.type, is_active: true }}>
              <div className="flex flex-col gap-4 pt-2">
                <OfferInputs />
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep({ kind: "choose_type" })}
                  >
                    {translate("ra.action.back", { _: "Back" })}
                  </Button>
                  <SaveButton
                    label={translate("resources.offers.action.create", {
                      _: "Create Offer",
                    })}
                  />
                </div>
              </div>
            </Form>
          </CreateBase>
        )}

        {step.kind === "cohort_form" && (
          <CreateBase
            resource="cohorts"
            redirect={false}
            mutationOptions={{ onSuccess: handleClose }}
          >
            <Form defaultValues={{ offer_id: step.offer.id, status: "draft" }}>
              <div className="flex flex-col gap-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  {translate("crm.programs.new_program_first_cohort", {
                    _: "%{offer} was created. Now set up its first Cohort.",
                    offer: step.offer.name,
                  })}
                </p>
                <CohortInputs />
                <div className="flex justify-end gap-2 pt-1">
                  <SaveButton
                    label={translate("resources.cohorts.action.create", {
                      _: "Create Cohort",
                    })}
                  />
                </div>
              </div>
            </Form>
          </CreateBase>
        )}
      </DialogContent>
    </Dialog>
  );
};
