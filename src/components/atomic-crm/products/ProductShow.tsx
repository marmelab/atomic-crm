import {
  ShowBase,
  useCreate,
  useLocaleState,
  useNotify,
  useRecordContext,
  useTranslate,
  type Identifier,
} from "ra-core";
import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeftRight, Pencil } from "lucide-react";
import { DeleteButton } from "@/components/admin/delete-button";
import { ReferenceField } from "@/components/admin/reference-field";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { DataTable } from "@/components/admin/data-table";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form } from "ra-core";

import { formatMoney } from "../money/money";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { MovesTable } from "../stock/StockMoveList";
import { ReversedMovesProvider } from "../stock/MoveFields";
import { formatQuantity, isStocked } from "./productOptions";
import type { Product, StockLevel } from "./types";
import { useWarehouseChoices } from "./useStockData";

/** A product: its prices, codes, stock per warehouse, suppliers and moves. */
export const ProductShow = () => (
  <ShowBase>
    <ProductShowContent />
  </ShowBase>
);

const ProductShowContent = () => {
  const record = useRecordContext<Product>();
  const translate = useTranslate();
  const notify = useNotify();
  if (!record) return null;
  const stocked = isStocked(record.kind);

  return (
    <div className="mt-2 flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-2xl font-semibold">{record.name}</h1>
              <p className="text-sm text-muted-foreground">
                {translate(`crm.products.kinds.${record.kind}`)}
                {record.sku ? ` · ${record.sku}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {stocked ? (
                <Button
                  variant="outline"
                  render={
                    <Link to={`/stock_moves/create?product_id=${record.id}`} />
                  }
                >
                  <ArrowLeftRight />
                  {translate("resources.stock_moves.action.new")}
                </Button>
              ) : null}
              <Button
                variant="outline"
                render={<Link to={`/products/${record.id}`} />}
              >
                <Pencil />
                {translate("ra.action.edit")}
              </Button>
            </div>
          </div>
          <ProductFacts />
        </CardContent>
      </Card>
      {stocked ? <StockPerWarehouse /> : null}
      <SupplierSkus />
      {stocked ? (
        <Card>
          <CardContent>
            <h2 className="mb-2 text-lg font-semibold">
              {translate("crm.stock.history")}
            </h2>
            <ReferenceManyField
              reference="stock_moves"
              target="product_id"
              sort={{ field: "id", order: "DESC" }}
              perPage={20}
            >
              <ReversedMovesProvider>
                <MovesTable showProduct={false} />
              </ReversedMovesProvider>
            </ReferenceManyField>
          </CardContent>
        </Card>
      ) : null}
      <div>
        <DeleteButton
          redirect="list"
          mutationOptions={{
            // A product with stock moves keeps them: it is archived instead
            onError: () =>
              notify("crm.products.delete_has_moves", { type: "error" }),
          }}
        />
      </div>
    </div>
  );
};

const Fact = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="tabular-nums">{children}</span>
  </div>
);

const ProductFacts = () => {
  const record = useRecordContext<Product>();
  const translate = useTranslate();
  const [uiLocale = "uk"] = useLocaleState();
  const { locale } = useConfigurationContext();
  if (!record) return null;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Fact label={translate("resources.products.fields.price")}>
        {record.price != null
          ? formatMoney(record.price, record.currency, locale)
          : "—"}
      </Fact>
      {isStocked(record.kind) ? (
        <>
          <Fact label={translate("resources.products.fields.quantity")}>
            {formatQuantity(record.quantity, uiLocale)}{" "}
            {translate(`crm.units.${record.unit_code}`)}
          </Fact>
          <Fact label={translate("resources.products.fields.average_cost")}>
            {record.average_cost != null
              ? formatMoney(record.average_cost, record.currency, locale)
              : "—"}
          </Fact>
        </>
      ) : null}
      <Fact label={translate("resources.products.fields.vat_rate_code")}>
        {record.vat_rate_code
          ? translate(`crm.products.vat.${record.vat_rate_code}`, {
              _: record.vat_rate_code,
            })
          : translate("crm.products.no_vat")}
      </Fact>
      {record.barcodes.length ? (
        <div className="col-span-full flex flex-wrap gap-1">
          {record.barcodes.map((code) => (
            <Badge key={code} variant="outline" className="font-mono">
              {code}
            </Badge>
          ))}
        </div>
      ) : null}
      {record.description ? (
        <p className="col-span-full text-sm whitespace-pre-line">
          {record.description}
        </p>
      ) : null}
    </div>
  );
};

const StockPerWarehouse = () => {
  const translate = useTranslate();
  const [locale = "uk"] = useLocaleState();
  const { choices } = useWarehouseChoices();
  const record = useRecordContext<Product>();
  return (
    <Card>
      <CardContent>
        <h2 className="mb-2 text-lg font-semibold">
          {translate("crm.stock.per_warehouse")}
        </h2>
        <ReferenceManyField
          reference="stock_levels"
          target="product_id"
          empty={
            <p className="text-sm text-muted-foreground">
              {translate("crm.stock.none")}
            </p>
          }
        >
          <DataTable bulkActionButtons={false} rowClick={false}>
            <DataTable.Col
              source="warehouse_id"
              render={(level: StockLevel) =>
                choices.find((choice) => choice.id === level.warehouse_id)?.name
              }
            />
            <DataTable.Col
              source="quantity"
              className="text-right"
              render={(level: StockLevel) =>
                `${formatQuantity(level.quantity, locale)} ${translate(
                  `crm.units.${record?.unit_code}`,
                )}`
              }
            />
          </DataTable>
        </ReferenceManyField>
      </CardContent>
    </Card>
  );
};

const SupplierSkus = () => {
  const translate = useTranslate();
  const record = useRecordContext<Product>();
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          {translate("crm.products.supplier_skus")}
        </h2>
        <ReferenceManyField
          reference="supplier_skus"
          target="product_id"
          empty={
            <p className="text-sm text-muted-foreground">
              {translate("crm.products.no_supplier_skus")}
            </p>
          }
        >
          <DataTable bulkActionButtons={false} rowClick={false}>
            <DataTable.Col source="supplier_id">
              <ReferenceField
                source="supplier_id"
                reference="companies"
                link="show"
              />
            </DataTable.Col>
            <DataTable.Col source="sku" />
          </DataTable>
        </ReferenceManyField>
        {record ? <AddSupplierSku productId={record.id} /> : null}
      </CardContent>
    </Card>
  );
};

const AddSupplierSku = ({ productId }: { productId: Identifier }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const [create, { isPending }] = useCreate();
  const [sku, setSku] = useState("");

  return (
    <Form
      resource="supplier_skus"
      onSubmit={(values: { supplier_id?: Identifier }) =>
        create(
          "supplier_skus",
          {
            data: {
              product_id: productId,
              supplier_id: values.supplier_id,
              sku: sku.trim(),
            },
          },
          {
            onSuccess: () => setSku(""),
            onError: () =>
              notify("crm.products.supplier_sku_failed", { type: "error" }),
          },
        )
      }
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <ReferenceInput
            source="supplier_id"
            reference="companies"
            filter={{ "roles@cs": "{supplier}" }}
          >
            <AutocompleteInput
              optionText="name"
              label="resources.supplier_skus.fields.supplier_id"
              helperText={false}
            />
          </ReferenceInput>
        </div>
        <Input
          aria-label={translate("resources.supplier_skus.fields.sku")}
          placeholder={translate("resources.supplier_skus.fields.sku")}
          value={sku}
          onChange={(event) => setSku(event.target.value)}
          className="w-40"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={!sku.trim() || isPending}
        >
          {translate("ra.action.add")}
        </Button>
      </div>
    </Form>
  );
};
