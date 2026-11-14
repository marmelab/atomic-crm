import { Create } from "@/components/admin/create";
import { Edit } from "@/components/admin/edit";
import { SimpleForm } from "@/components/admin/simple-form";

import { ProductInputs } from "./ProductInputs";

export const ProductCreate = () => (
  <Create redirect="show">
    <SimpleForm
      defaultValues={{ kind: "goods", unit_code: "pcs", barcodes: [] }}
    >
      <ProductInputs />
    </SimpleForm>
  </Create>
);

export const ProductEdit = () => (
  <Edit
    redirect="show"
    mutationMode="pessimistic"
    // quantity and average_cost come from products_summary, not the table
    transform={({ quantity: _q, average_cost: _c, ...product }) => product}
  >
    <SimpleForm>
      <ProductInputs isEdit />
    </SimpleForm>
  </Edit>
);
