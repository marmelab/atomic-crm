import { required, useTranslate } from "ra-core";
import { BooleanInput } from "@/components/admin/boolean-input";
import { RadioButtonGroupInput } from "@/components/admin/radio-button-group-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextArrayInput } from "@/components/admin/text-array-input";
import { TextInput } from "@/components/admin/text-input";

import { MoneyInput } from "../money/MoneyInput";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { PRODUCT_KINDS, UNIT_CODES } from "./productOptions";
import { useTaxRates } from "./useStockData";

/** Fields of a product: kind, name, codes, unit, price and VAT rate. */
export const ProductInputs = ({ isEdit = false }: { isEdit?: boolean }) => {
  const translate = useTranslate();
  const { currency } = useConfigurationContext();
  const taxRates = useTaxRates();

  return (
    <div className="flex flex-col gap-4 p-1">
      <RadioButtonGroupInput
        source="kind"
        choices={PRODUCT_KINDS.map((kind) => ({
          id: kind,
          name: translate(`crm.products.kinds.${kind}`),
        }))}
        row
        helperText={false}
      />
      <TextInput source="name" validate={required()} helperText={false} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput source="sku" helperText={false} />
        <SelectInput
          source="unit_code"
          choices={UNIT_CODES.map((code) => ({
            id: code,
            name: translate(`crm.units.${code}`),
          }))}
          validate={required()}
          helperText={false}
        />
        <MoneyInput source="price" currency={currency} helperText={false} />
        <SelectInput
          source="vat_rate_code"
          choices={taxRates.map((rate) => ({
            id: rate.code,
            name: `${Number(rate.rate)}%`,
          }))}
          emptyText={translate("crm.products.no_vat")}
          helperText={false}
        />
      </div>
      <TextArrayInput
        source="barcodes"
        helperText={translate("crm.products.barcodes_hint")}
      />
      <TextInput source="description" multiline helperText={false} />
      {isEdit ? <BooleanInput source="archived" helperText={false} /> : null}
    </div>
  );
};
