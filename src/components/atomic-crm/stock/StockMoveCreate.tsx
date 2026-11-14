import {
  CreateBase,
  Form,
  required,
  useNotify,
  useTranslate,
  type Identifier,
} from "ra-core";
import { useSearchParams } from "react-router";
import { useWatch } from "react-hook-form";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { CancelButton } from "@/components/admin/cancel-button";
import { SaveButton } from "@/components/admin/form";
import { NumberInput } from "@/components/admin/number-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { SelectInput } from "@/components/admin/select-input";
import { TextInput } from "@/components/admin/text-input";
import { Card, CardContent } from "@/components/ui/card";

import { MoneyInput } from "../money/MoneyInput";
import { useWarehouseChoices } from "../products/useStockData";
import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  FORM_KINDS,
  takesFrom,
  takesTo,
  toStockMove,
  type FormKind,
} from "./stockMoveForm";

/** Posts a stock move: receipt, issue, transfer or a correction. */
export const StockMoveCreate = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const [searchParams] = useSearchParams();
  const { choices, isPending } = useWarehouseChoices();
  const defaultWarehouse = choices[0]?.id ?? null;
  const productId = searchParams.get("product_id");

  if (isPending) return null;

  return (
    <CreateBase
      resource="stock_moves"
      redirect={productId ? `/products/${productId}/show` : "list"}
      transform={toStockMove}
      mutationOptions={{
        onError: (error: Error) => {
          const available = /Not enough stock: ([\d.]+)/.exec(error.message);
          notify(
            available
              ? translate("crm.stock.not_enough_detail", {
                  available: Number(available[1]),
                })
              : error.message.includes("service")
                ? "crm.stock.service_no_stock"
                : "crm.stock.move_failed",
            { type: "error" },
          );
        },
      }}
    >
      <div className="mt-2 max-w-2xl">
        <Card>
          <CardContent>
            <Form
              defaultValues={{
                kind: "receipt",
                product_id: productId ? Number(productId) : undefined,
                from_warehouse_id: defaultWarehouse,
                to_warehouse_id: defaultWarehouse,
              }}
            >
              <h1 className="mb-4 text-xl font-semibold">
                {translate("resources.stock_moves.action.new")}
              </h1>
              <MoveInputs choices={choices} />
              <div
                role="toolbar"
                className="flex flex-row justify-end gap-2 pt-4"
              >
                <CancelButton />
                <SaveButton label={translate("crm.stock.post")} />
              </div>
            </Form>
          </CardContent>
        </Card>
      </div>
    </CreateBase>
  );
};

const MoveInputs = ({
  choices,
}: {
  choices: { id: Identifier; name: string }[];
}) => {
  const translate = useTranslate();
  const { currency } = useConfigurationContext();
  const kind = (useWatch({ name: "kind" }) as FormKind) ?? "receipt";

  return (
    <div className="flex flex-col gap-4">
      <SelectInput
        source="kind"
        choices={FORM_KINDS.map((id) => ({
          id,
          name: translate(`crm.stock.form_kinds.${id}`),
        }))}
        validate={required()}
        helperText={false}
      />
      <ReferenceInput
        source="product_id"
        reference="products"
        filter={{ "kind@neq": "service", archived: false }}
      >
        <AutocompleteInput
          optionText="name"
          label="resources.stock_moves.fields.product_id"
          validate={required()}
          helperText={false}
        />
      </ReferenceInput>
      <div className="grid gap-4 sm:grid-cols-2">
        {takesFrom(kind) ? (
          <SelectInput
            source="from_warehouse_id"
            choices={choices}
            validate={required()}
            helperText={false}
          />
        ) : null}
        {takesTo(kind) ? (
          <SelectInput
            source="to_warehouse_id"
            choices={choices}
            validate={required()}
            helperText={false}
          />
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberInput
          source="quantity"
          min={0}
          step="any"
          validate={required()}
          helperText={false}
        />
        {kind === "receipt" ? (
          <MoneyInput
            source="unit_cost"
            currency={currency}
            validate={required()}
            helperText={false}
          />
        ) : null}
      </div>
      {kind === "receipt" ? (
        <ReferenceInput
          source="counterparty_id"
          reference="companies"
          filter={{ "roles@cs": "{supplier}" }}
        >
          <AutocompleteInput
            optionText="name"
            label="resources.stock_moves.fields.counterparty_id"
            helperText={false}
          />
        </ReferenceInput>
      ) : null}
      <TextInput source="note" helperText={false} />
    </div>
  );
};
