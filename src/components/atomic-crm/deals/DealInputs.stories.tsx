import type { Meta } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { Form } from "ra-core";
import { Create } from "@/components/admin/create";
import { SaveButton } from "@/components/admin/form";
import { FormToolbar } from "@/components/admin/simple-form";
import { StoryWrapper, buildContact } from "@/test/StoryWrapper";
import { DealInputs } from "./DealInputs";

const meta = {
  title: "Atomic CRM/Deals/DealInputs",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

const defaultData = {
  companies: [{ id: 1, name: "Smith Corp", sales_id: 0 }],
  contacts: [
    buildContact({
      company_id: 1,
      first_name: "Ada",
      id: 1,
      last_name: "Lovelace",
    }),
  ],
};

export const CreateForm = ({
  children,
  data = defaultData,
}: {
  children?: ReactNode;
  data?: any;
}) => (
  <StoryWrapper data={data}>
    <Create resource="deals">
      <Form defaultValues={{ contact_ids: [], index: 0, sales_id: 0 }}>
        <DealInputs />
        <FormToolbar>
          <SaveButton />
        </FormToolbar>
      </Form>
    </Create>
    {children}
  </StoryWrapper>
);
