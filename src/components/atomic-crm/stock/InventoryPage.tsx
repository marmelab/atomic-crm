import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useDataProvider,
  useGetList,
  useLocaleState,
  useNotify,
  useTranslate,
  type Identifier,
} from "ra-core";
import { useState, type FormEvent } from "react";
import { Minus, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { formatQuantity } from "../products/productOptions";
import type { Product, StockLevel } from "../products/types";
import { useWarehouseChoices } from "../products/useStockData";
import type { CrmDataProvider } from "../providers/types";
import { CameraScanButton } from "./CameraScanner";
import {
  addCount,
  changeCount,
  removeCount,
  type CountedLine,
} from "./inventoryCounts";

/**
 * Inventory from a phone (TZ section 5.6): pick a warehouse, find each product
 * by barcode, article or name, count it, then post. Only the differences with
 * the stock become adjustments.
 */
export const InventoryPage = () => {
  const translate = useTranslate();
  const { choices, isPending } = useWarehouseChoices();
  const [warehouseId, setWarehouseId] = useState<Identifier | null>(null);
  const current = warehouseId ?? choices[0]?.id ?? null;

  if (isPending) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4 md:px-0">
      <h1 className="text-2xl font-semibold">
        {translate("crm.inventory.title")}
      </h1>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="inventory-warehouse">
          {translate("resources.stock_levels.fields.warehouse_id")}
        </Label>
        <Select
          value={current != null ? String(current) : ""}
          onValueChange={(value) => setWarehouseId(Number(value))}
        >
          <SelectTrigger id="inventory-warehouse" className="w-full">
            <SelectValue>
              {choices.find((choice) => choice.id === current)?.name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {choices.map((choice) => (
              <SelectItem key={choice.id} value={String(choice.id)}>
                {choice.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {current != null ? (
        <InventoryCount key={current} warehouseId={current} />
      ) : null}
    </div>
  );
};

const InventoryCount = ({ warehouseId }: { warehouseId: Identifier }) => {
  const translate = useTranslate();
  const notify = useNotify();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider<CrmDataProvider>();
  const [lines, setLines] = useState<CountedLine[]>([]);
  const [matches, setMatches] = useState<Product[]>([]);

  const { data: levels = [] } = useGetList<StockLevel>("stock_levels", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "product_id", order: "ASC" },
    filter: { warehouse_id: warehouseId },
  });
  const expected = (productId: Identifier) =>
    Number(
      levels.find((level) => level.product_id === productId)?.quantity ?? 0,
    );

  const add = (product: Product) => {
    setMatches([]);
    setLines((current) => addCount(current, product));
  };

  const find = async (text: string) => {
    const code = text.trim();
    if (!code) return;
    const stocked = { "kind@neq": "service", archived: false };
    const byBarcode = await dataProvider.getList<Product>("products", {
      pagination: { page: 1, perPage: 2 },
      sort: { field: "name", order: "ASC" },
      filter: { ...stocked, "barcodes@cs": `{"${code.replace(/"/g, "")}"}` },
    });
    if (byBarcode.data.length === 1) return add(byBarcode.data[0]);
    const byText = await dataProvider.getList<Product>("products", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "name", order: "ASC" },
      filter: { ...stocked, q: code },
    });
    if (byText.data.length === 1) return add(byText.data[0]);
    if (byText.data.length === 0) {
      notify("crm.inventory.not_found", {
        type: "warning",
        messageArgs: { code },
      });
    }
    setMatches(byText.data);
  };

  const { mutate: post, isPending } = useMutation({
    mutationFn: () =>
      dataProvider.postInventory(
        warehouseId,
        lines.map((line) => ({
          product_id: line.product.id,
          quantity: line.counted,
        })),
        translate("crm.inventory.title"),
      ),
    onSuccess: (posted) => {
      notify("crm.inventory.posted", {
        type: "success",
        messageArgs: { smart_count: posted },
      });
      setLines([]);
      queryClient.invalidateQueries();
    },
    onError: () => notify("crm.inventory.failed", { type: "error" }),
  });

  return (
    <>
      <FindProduct onFind={find} />
      {matches.length > 0 ? (
        <Card>
          <CardContent className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">
              {translate("crm.inventory.pick")}
            </p>
            {matches.map((product) => (
              <Button
                key={product.id}
                variant="ghost"
                className="justify-start"
                onClick={() => add(product)}
              >
                {product.name}
                {product.sku ? (
                  <span className="text-muted-foreground">{product.sku}</span>
                ) : null}
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}
      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate("crm.inventory.empty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lines.map((line) => (
            <CountedRow
              key={line.product.id}
              line={line}
              expected={expected(line.product.id)}
              onChange={(counted) =>
                setLines((current) =>
                  changeCount(current, line.product.id, counted),
                )
              }
              onRemove={() =>
                setLines((current) => removeCount(current, line.product.id))
              }
            />
          ))}
        </ul>
      )}
      <Button
        size="lg"
        disabled={lines.length === 0 || isPending}
        onClick={() => post()}
      >
        {translate("crm.inventory.post")}
      </Button>
    </>
  );
};

const FindProduct = ({ onFind }: { onFind: (text: string) => void }) => {
  const translate = useTranslate();
  const [text, setText] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onFind(text);
    setText("");
  };
  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        aria-label={translate("crm.inventory.find")}
        placeholder={translate("crm.inventory.find")}
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoFocus
        enterKeyHint="search"
        className="h-11 flex-1"
      />
      <Button type="submit" variant="outline" className="h-11">
        <Search />
        <span className="sr-only">{translate("ra.action.search")}</span>
      </Button>
      <CameraScanButton onScan={onFind} />
    </form>
  );
};

const CountedRow = ({
  line,
  expected,
  onChange,
  onRemove,
}: {
  line: CountedLine;
  expected: number;
  onChange: (counted: number) => void;
  onRemove: () => void;
}) => {
  const translate = useTranslate();
  const [locale = "uk"] = useLocaleState();
  const difference = line.counted - expected;
  const unit = translate(`crm.units.${line.product.unit_code}`);

  return (
    <li className="flex flex-col gap-2 rounded-md border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium break-words">{line.product.name}</p>
          <p className="text-sm text-muted-foreground">
            {translate("crm.inventory.expected", {
              quantity: `${formatQuantity(expected, locale)} ${unit}`,
            })}
            {difference !== 0 ? (
              <span
                className={
                  difference > 0 ? " text-primary" : " text-destructive"
                }
              >
                {" "}
                ({difference > 0 ? "+" : ""}
                {formatQuantity(difference, locale)})
              </span>
            ) : null}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={translate("ra.action.remove")}
        >
          <X />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="size-11"
          onClick={() => onChange(Math.max(0, line.counted - 1))}
          aria-label="−1"
        >
          <Minus />
        </Button>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={line.counted}
          onChange={(event) =>
            onChange(Math.max(0, Number(event.target.value)))
          }
          aria-label={translate("crm.inventory.counted", {
            name: line.product.name,
          })}
          className="h-11 w-28 text-center tabular-nums"
        />
        <Button
          variant="outline"
          size="icon"
          className="size-11"
          onClick={() => onChange(line.counted + 1)}
          aria-label="+1"
        >
          <Plus />
        </Button>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
    </li>
  );
};

InventoryPage.path = "/inventory";
