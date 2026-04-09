import { useRecordContext } from "ra-core";
import { CreateButton } from "@/components/admin/create-button";
import { DataTable } from "@/components/admin/data-table";
import { DateField } from "@/components/admin/date-field";
import { List } from "@/components/admin/list";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Badge } from "@/components/ui/badge";

import { TopToolbar } from "../layout/TopToolbar";
import type { ServiceContract } from "../types";
import { formatPrice, getStatusLabel, isExpiringSoon } from "./contractUtils";

const ListActions = () => (
  <TopToolbar>
    <CreateButton />
  </TopToolbar>
);

const AmountField = (_props: { label?: string | boolean }) => {
  const record = useRecordContext<ServiceContract>();
  if (!record) return null;
  return <span>{formatPrice(record.amount)}</span>;
};

const StatusField = (_props: { label?: string | boolean }) => {
  const record = useRecordContext<ServiceContract>();
  if (!record) return null;
  const expiring = isExpiringSoon(record.renewal_date);
  return (
    <Badge variant={expiring ? "destructive" : "default"}>
      {getStatusLabel(record.status)}
    </Badge>
  );
};

export const ServiceContractList = () => (
  <List
    sort={{ field: "renewal_date", order: "ASC" }}
    actions={<ListActions />}
  >
    <DataTable>
      <DataTable.Col source="name" />
      <DataTable.Col label="Entreprise">
        <ReferenceField source="company_id" reference="companies">
          <TextField source="name" />
        </ReferenceField>
      </DataTable.Col>
      <DataTable.Col source="renewal_date">
        <DateField source="renewal_date" />
      </DataTable.Col>
      <DataTable.Col label="Montant">
        <AmountField />
      </DataTable.Col>
      <DataTable.Col label="Statut">
        <StatusField />
      </DataTable.Col>
    </DataTable>
  </List>
);

export default ServiceContractList;
