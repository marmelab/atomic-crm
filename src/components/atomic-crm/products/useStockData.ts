import { useGetList, useTranslate } from "ra-core";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { TaxRate, Warehouse } from "./types";

/** The default warehouse has no name: it is called in the interface language. */
export const useWarehouseName = () => {
  const translate = useTranslate();
  return (warehouse: Pick<Warehouse, "name"> | undefined | null): string =>
    warehouse?.name ?? translate("crm.stock.default_warehouse");
};

/** Active warehouses as select choices, the default one first. */
export const useWarehouseChoices = () => {
  const warehouseName = useWarehouseName();
  const { data = [], isPending } = useGetList<Warehouse>("warehouses", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "id", order: "ASC" },
    filter: { archived: false },
  });
  const choices = [...data]
    .sort((a, b) => Number(b.is_default) - Number(a.is_default))
    .map((warehouse) => ({ id: warehouse.id, name: warehouseName(warehouse) }));
  return { choices, warehouses: data, isPending };
};

interface TaxRateRow extends TaxRate {
  id: number;
  country_code: string;
  valid_from: string;
  valid_to: string | null;
}

/** VAT rates of the business country that apply today (country pack data). */
export const useTaxRates = (): TaxRate[] => {
  const { countryCode } = useConfigurationContext();
  const { data = [] } = useGetList<TaxRateRow>(
    "tax_rates",
    {
      pagination: { page: 1, perPage: 50 },
      sort: { field: "rate", order: "DESC" },
      filter: { country_code: countryCode, tax: "vat" },
    },
    { enabled: !!countryCode, staleTime: Infinity },
  );
  const today = new Date().toISOString().slice(0, 10);
  return data.filter(
    (rate) =>
      rate.valid_from <= today && (!rate.valid_to || rate.valid_to > today),
  );
};
