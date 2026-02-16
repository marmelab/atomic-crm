import { EditBase, Form } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";

import { CompanyInputs } from "./CompanyInputs";
import { CompanyAside } from "./CompanyAside";
import { FormToolbar } from "../layout/FormToolbar";

export const CompanyEdit = () => (
  <EditBase
    actions={false}
    redirect="show"
    transform={(values) => {
      // add https:// before website if not present
      if (values.website && !values.website.startsWith("http")) {
        values.website = `https://${values.website}`;
      }
      return values;
    }}
  >
    <div className="mt-4 flex gap-6">
      <Form className="flex flex-1 flex-col gap-4 pb-2">
        <Card>
          <CardContent>
            <div className="pb-4 mb-4 border-b border-border">
              <h2 className="text-xl font-semibold">Edit Company</h2>
            </div>
            <CompanyInputs />
            <div className="pt-4 mt-4 border-t border-border">
              <FormToolbar />
            </div>
          </CardContent>
        </Card>
      </Form>

      <CompanyAside link="show" />
    </div>
  </EditBase>
);
