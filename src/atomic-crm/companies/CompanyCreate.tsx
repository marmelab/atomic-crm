import { Form, useGetIdentity } from "ra-core";

import { CancelButton, Create } from "@/components/admin";
import { SaveButton } from "@/components/admin";
import { FormToolbar } from "@/components/admin";
import { CompanyInputs } from "./CompanyInputs";

export const CompanyCreate = () => {
  const { identity } = useGetIdentity();
  return (
    <Create
      redirect="show"
      transform={(values) => {
        // add https:// before website if not present
        if (values.website && !values.website.startsWith("http")) {
          values.website = `https://${values.website}`;
        }
        return values;
      }}
    >
      <Form defaultValues={{ sales_id: identity?.id }}>
        <CompanyInputs />
        <FormToolbar>
          <div className="flex flex-row gap-2 justify-end">
            <CancelButton />
            <SaveButton label="Create Company" />
          </div>
        </FormToolbar>
      </Form>
    </Create>
  );
};
