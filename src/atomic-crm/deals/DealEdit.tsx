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
import { Deal } from "../types";
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
      <DialogContent className="lg:max-w-4xl overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
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
      <div className="flex items-center justify-between space-x-4">
        <div className="flex items-center gap-8">
          <ReferenceField source="company_id" reference="companies" link="show">
            <CompanyAvatar />
          </ReferenceField>
          <h3 className="text-lg font-semibold">Edit {deal.name} deal</h3>
        </div>

        <div className="flex space-x-4 pr-12">
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
