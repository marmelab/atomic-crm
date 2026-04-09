import { Edit } from "@/components/admin/edit";
import { SimpleForm } from "@/components/admin/simple-form";

import { ProductInputs } from "./ProductInputs";

const ProductEdit = () => (
  <Edit>
    <SimpleForm>
      <ProductInputs />
    </SimpleForm>
  </Edit>
);

export default ProductEdit;
