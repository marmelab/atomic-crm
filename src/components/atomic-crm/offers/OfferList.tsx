import { useRecordContext, useTranslate } from "ra-core";
import { DataTable } from "@/components/admin/data-table";
import { List } from "@/components/admin/list";
import { NumberField } from "@/components/admin/number-field";
import { Badge } from "@/components/ui/badge";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Offer } from "../types";
import { offerTypeLabels } from "./offerConstants";

// Administrative/reference UI — the owner inspects Offers here; pricing
// changes go through the database directly for this slice (see AGENTS.md /
// the "Offers" section of the domain-model proof slice report).
export const OfferList = () => {
  const translate = useTranslate();
  return (
    <List
      title={translate("resources.offers.name", { smart_count: 2 })}
      sort={{ field: "name", order: "ASC" }}
      pagination={false}
    >
      <DataTable rowClick="show">
        <DataTable.Col source="name" />
        <DataTable.Col label="resources.offers.fields.type">
          <TypeField />
        </DataTable.Col>
        <DataTable.Col source="duration" />
        <DataTable.Col label="resources.offers.fields.current_price">
          <PriceField />
        </DataTable.Col>
        <DataTable.Col source="max_active_clients" />
        <DataTable.Col label="resources.offers.fields.is_active">
          <ActiveField />
        </DataTable.Col>
      </DataTable>
    </List>
  );
};

const TypeField = () => {
  const record = useRecordContext<Offer>();
  if (!record) return null;
  return <span>{offerTypeLabels[record.type]}</span>;
};

const PriceField = () => {
  const { currency } = useConfigurationContext();
  return (
    <NumberField
      source="current_price"
      options={{ style: "currency", currency }}
    />
  );
};

const ActiveField = () => {
  const record = useRecordContext<Offer>();
  const translate = useTranslate();
  if (!record) return null;
  return (
    <Badge variant={record.is_active ? "outline" : "secondary"}>
      {translate(
        record.is_active
          ? "resources.offers.active"
          : "resources.offers.inactive",
      )}
    </Badge>
  );
};
