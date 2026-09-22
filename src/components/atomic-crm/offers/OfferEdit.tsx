import { EditBase, Form } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";

import { FormToolbar } from "../layout/FormToolbar";
import { OfferInputs } from "./OfferInputs";

// Editing a 1:1 Program. Mirrors CohortEdit exactly — EditBase loads the
// record and the same inputs the create flow uses populate themselves from
// it, so there is no second form to drift from the first.
//
// It carries no cohort schedule fields, and that is the type distinction
// doing its job: a 1:1 program has no shared start, duration or end,
// because each client has their own.
export const OfferEdit = () => (
  <EditBase actions={false} redirect="show">
    <div className="mt-2 flex gap-8">
      <Form className="flex flex-1 flex-col gap-4 pb-2">
        <Card>
          <CardContent>
            <OfferInputs />
            <FormToolbar />
          </CardContent>
        </Card>
      </Form>
    </div>
  </EditBase>
);
