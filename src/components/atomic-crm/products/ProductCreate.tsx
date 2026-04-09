import { Create } from "@/components/admin/create";
import { SimpleForm } from "@/components/admin/simple-form";

import { ProductInputs } from "./ProductInputs";

const ProductCreate = () => (
  <Create>
    <SimpleForm defaultValues={{ active: true }}>
      <ProductInputs />
    </SimpleForm>
  </Create>
);

export default ProductCreate;
