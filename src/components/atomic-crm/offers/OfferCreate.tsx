import { CreateBase, Form, useTranslate } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { CancelButton } from "@/components/admin/cancel-button";
import { SaveButton } from "@/components/admin/form";

import { OfferInputs } from "./OfferInputs";

// Administrative create form, reached either from the Offers admin menu or
// embedded in the Programs hub's "+ New Program" flow (see
// programs/NewProgramDialog.tsx).
export const OfferCreate = () => {
  const translate = useTranslate();
  return (
    <CreateBase redirect="show">
      <div className="mt-2 flex lg:mr-72">
        <div className="flex-1">
          <Form defaultValues={{ is_active: true }}>
            <Card>
              <CardContent>
                <OfferInputs />
                <div
                  role="toolbar"
                  className="sticky flex pt-4 pb-4 md:pb-0 bottom-0 bg-linear-to-b from-transparent to-card to-10% flex-row justify-end gap-2"
                >
                  <CancelButton />
                  <SaveButton
                    label={translate("resources.offers.action.create", {
                      _: "Create Offer",
                    })}
                  />
                </div>
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
