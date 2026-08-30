import { useRecordContext, useTranslate } from "ra-core";
import { DataTable } from "@/components/admin/data-table";
import { NumberField } from "@/components/admin/number-field";
import { RecordField } from "@/components/admin/record-field";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { Show } from "@/components/admin/show";
import { Badge } from "@/components/ui/badge";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Offer } from "../types";
import { offerTypeLabels } from "./offerConstants";

// Administrative/reference UI: lets the owner inspect an Offer's shape and
// payment options. Not meant to be beautiful — see the domain-model proof
// slice report for why Offer editing isn't built in this slice.
export const OfferShow = () => (
  <Show>
    <div className="flex flex-col gap-4">
      <RecordField source="name" />
      <RecordField label="resources.offers.fields.type" render={renderType} />
      <RecordField source="duration" />
      <RecordField label="resources.offers.fields.current_price">
        <PriceField />
      </RecordField>
      <RecordField source="max_active_clients" />
      <RecordField
        label="resources.offers.fields.is_active"
        render={(record: Offer) => (record.is_active ? "Yes" : "No")}
      />
      <PaymentOptionsSection />
    </div>
  </Show>
);

const renderType = (record: Offer) => offerTypeLabels[record.type];

const PriceField = () => {
  const { currency } = useConfigurationContext();
  return (
    <NumberField
      source="current_price"
      options={{ style: "currency", currency }}
    />
  );
};

const PaymentOptionsSection = () => {
  const record = useRecordContext<Offer>();
  const translate = useTranslate();
  if (!record) return null;

  return (
    <div className="flex flex-col gap-2 mt-4">
      <h3 className="text-base font-medium">
        {translate("resources.offer_payment_options.name", {
          smart_count: 2,
        })}
      </h3>
      <ReferenceManyField
        reference="offer_payment_options"
        target="offer_id"
        sort={{ field: "id", order: "ASC" }}
      >
        <DataTable>
          <DataTable.Col source="name" />
          <DataTable.Col label="resources.offer_payment_options.fields.total">
            <NumberField source="total" />
          </DataTable.Col>
          <DataTable.Col source="installments" />
          <DataTable.Col label="resources.offer_payment_options.fields.installment_amount">
            <NumberField source="installment_amount" />
          </DataTable.Col>
          <DataTable.Col label={false}>
            <PublicBadge />
          </DataTable.Col>
        </DataTable>
      </ReferenceManyField>
    </div>
  );
};

const PublicBadge = () => {
  const record = useRecordContext();
  const translate = useTranslate();
  if (!record || record.is_public) return null;
  return (
    <Badge variant="outline">
      {translate("resources.offer_payment_options.authorized_only")}
    </Badge>
  );
};
