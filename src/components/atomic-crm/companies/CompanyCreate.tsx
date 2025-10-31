import { CreateBase, Form, useGetIdentity } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { CancelButton, SaveButton, FormToolbar } from "@/components/admin";

import { CompanyInputs } from "./CompanyInputs";

export const CompanyCreate = () => {
  const { identity } = useGetIdentity();
  return (
    <CreateBase
      redirect="show"
      transform={(values) => {
        // add https:// before website if not present
        if (values.website && !values.website.startsWith("http")) {
          values.website = `https://${values.website}`;
        }
        return values;
      }}
    >
      <div className="mt-2 flex lg:mr-72">
        <div className="flex-1">
          <Form defaultValues={{ sales_id: identity?.id }}>
            <Card>
              <CardContent>
                <CompanyInputs />
                <FormToolbar>
                  <div className="flex flex-row gap-2 justify-end">
                    <CancelButton />
                    <SaveButton label="Create Company" />
                  </div>
                </FormToolbar>
              </CardContent>
            </Card>
          </Form>
        </div>
      </div>
    </CreateBase>
  );
};
