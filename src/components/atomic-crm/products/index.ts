import type { Product } from "./types";
import { ProductCreate, ProductEdit } from "./ProductCreate";
import { ProductList } from "./ProductList";
import { ProductShow } from "./ProductShow";

export default {
  list: ProductList,
  create: ProductCreate,
  edit: ProductEdit,
  show: ProductShow,
  recordRepresentation: (record: Product) => record.name,
};
