import type { Supplier } from "../types";
import { SupplierCreate } from "./SupplierCreate";
import { SupplierEdit } from "./SupplierEdit";
import { SupplierList } from "./SupplierList";
import { SupplierShow } from "./SupplierShow";

export default {
  list: SupplierList,
  show: SupplierShow,
  edit: SupplierEdit,
  create: SupplierCreate,
  recordRepresentation: (record: Supplier) => record.name,
};
