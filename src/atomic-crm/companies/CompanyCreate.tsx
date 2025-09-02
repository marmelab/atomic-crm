import { Form, useGetIdentity } from "ra-core";

import { Create } from "@/components/admin";
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
          <SaveButton label="Create Company" />
        </FormToolbar>
      </Form>
    </Create>
  );
};
