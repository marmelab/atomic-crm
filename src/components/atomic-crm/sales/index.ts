import type { Sale } from "@/components/atomic-crm/types";
import { SalesCreate } from "@/components/atomic-crm/sales/SalesCreate";
import { SalesEdit } from "@/components/atomic-crm/sales/SalesEdit";
import { SalesList } from "@/components/atomic-crm/sales/SalesList";

export default {
  list: SalesList,
  create: SalesCreate,
  edit: SalesEdit,
  recordRepresentation: (record: Sale) =>
    `${record.first_name} ${record.last_name}`,
};
