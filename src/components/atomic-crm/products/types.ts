import type { Identifier, RaRecord } from "ra-core";

import type { MoveKind, ProductKind, UnitCode } from "./productOptions";

export interface Product extends RaRecord {
  kind: ProductKind;
  name: string;
  sku: string | null;
  unit_code: UnitCode;
  /** Sale price in minor units of currency */
  price: number | null;
  currency: string;
  vat_rate_code: string | null;
  barcodes: string[];
  description: string | null;
  archived: boolean;
  /** products_summary: stock in all warehouses */
  quantity?: number;
  /** products_summary: average purchase cost in minor units */
  average_cost?: number | null;
}

export interface Warehouse extends RaRecord {
  /** Empty for the default warehouse */
  name: string | null;
  is_default: boolean;
  archived: boolean;
}

export interface StockMove extends RaRecord {
  moved_at: string;
  kind: MoveKind;
  product_id: Identifier;
  from_warehouse_id: Identifier | null;
  to_warehouse_id: Identifier | null;
  quantity: number;
  unit_cost: number | null;
  currency: string;
  counterparty_id: Identifier | null;
  note: string | null;
  reverses_id: Identifier | null;
}

export interface StockLevel extends RaRecord {
  product_id: Identifier;
  warehouse_id: Identifier;
  unit_code: UnitCode;
  quantity: number;
}

export interface SupplierSku extends RaRecord {
  product_id: Identifier;
  supplier_id: Identifier;
  sku: string;
}

export interface TaxRate {
  code: string;
  rate: number;
  label: string;
}
