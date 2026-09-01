import { Form, useGetIdentity, useRedirect } from "ra-core";
import { Create } from "@/components/admin/create";
import { SaveButton } from "@/components/admin/form";
import { FormToolbar } from "@/components/admin/simple-form";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import { DealInputs } from "./DealInputs";

export const DealCreate = ({ open }: { open: boolean }) => {
  const redirect = useRedirect();

  const handleClose = () => {
    redirect("/deals");
  };

  const { identity } = useGetIdentity();

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="lg:max-w-4xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        {/* Kanban queue-ordering slice: creating an Opportunity is itself a
            genuine stage entry (into "interested"), so the shared "deals"
            hook already stamps stage_entered_at and records the
            deal_stage_events row — no onSuccess side effect needed here
            beyond closing. The column sorts oldest-in-stage first, so a
            brand-new Opportunity, being the newest, correctly lands at the
            bottom rather than needing every sibling's position bumped (the
            old manual `index` field this used to shuffle no longer drives
            display order at all — see ./stages.ts). */}
        <Create resource="deals" mutationOptions={{ onSuccess: handleClose }}>
          <Form
            defaultValues={{
              sales_id: identity?.id,
              stage: "interested",
              index: 0,
            }}
          >
            <DealInputs />
            <FormToolbar>
              <SaveButton />
            </FormToolbar>
          </Form>
        </Create>
      </DialogContent>
    </Dialog>
  );
};
