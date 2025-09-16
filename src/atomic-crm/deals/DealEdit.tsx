import { DeleteButton, ReferenceField } from "@/components/admin";
import { SaveButton } from "@/components/admin";
import { FormToolbar } from "@/components/admin";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  EditBase,
  Form,
  useNotify,
  useRecordContext,
  useRedirect,
} from "ra-core";
import { Link } from "react-router";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import type { Deal } from "../types";
import { DealInputs } from "./DealInputs";

export const DealEdit = ({ open, id }: { open: boolean; id?: string }) => {
  const redirect = useRedirect();
  const notify = useNotify();

  const handleClose = () => {
    redirect("/deals", undefined, undefined, undefined, {
      _scrollToTop: false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={() => handleClose()}>
      <DialogContent className="lg:max-w-4xl p-4 overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        {id ? (
          <EditBase
            id={id}
            mutationMode="pessimistic"
            mutationOptions={{
              onSuccess: () => {
                notify("Deal updated");
                redirect(`/deals/${id}/show`, undefined, undefined, undefined, {
                  _scrollToTop: false,
                });
              },
            }}
          >
            <EditHeader />
            <Form>
              <DealInputs />
              <EditToolbar />
            </Form>
          </EditBase>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

function EditHeader() {
  const deal = useRecordContext<Deal>();
  if (!deal) {
    return null;
  }

  return (
    <DialogTitle className="pb-0">
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-4">
          <ReferenceField source="company_id" reference="companies" link="show">
            <CompanyAvatar />
          </ReferenceField>
          <h2 className="text-2xl font-semibold">Edit {deal.name} deal</h2>
        </div>
        <div className="flex gap-2 pr-12">
          <Button asChild variant="outline" className="h-9">
            <Link to={`/deals/${deal.id}/show`}>Back to deal</Link>
          </Button>
        </div>
      </div>
    </DialogTitle>
  );
}

function EditToolbar() {
  return (
    <FormToolbar>
      <div className="flex-1 flex justify-between">
        <DeleteButton />
        <SaveButton />
      </div>
    </FormToolbar>
  );
}
