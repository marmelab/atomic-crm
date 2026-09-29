import { useEffect, type ReactNode } from "react";
import type { Exporter, InputProps } from "ra-core";
import jsonExport from "jsonexport/dist";
import {
  downloadCSV,
  useCanAccess,
  useGetIdentity,
  useListContext,
  useTranslate,
} from "ra-core";
import { matchPath, useLocation } from "react-router";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { ReferenceInput } from "@/components/admin/reference-input";
import { FilterButton } from "@/components/admin/filter-form";
import { SearchInput } from "@/components/admin/search-input";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";

import { DataImportButton } from "../dataImport/DataImportButton";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { TopToolbar } from "../layout/TopToolbar";
import { AccountManagerInput } from "../sales/AccountManagerInput";
import { DealArchivedList } from "./DealArchivedList";
import { DealCreate } from "./DealCreate";
import { DealEdit } from "./DealEdit";
import { DealEmpty } from "./DealEmpty";
import { DealListContent } from "./DealListContent";
import { DealShow } from "./DealShow";
import type { Deal } from "../types";
import { formatCategoryAmounts, mapLegacyCategoryFilter } from "./dealUtils";
import { OnlyMineInput } from "./OnlyMineInput";

const DealList = () => {
  const { identity } = useGetIdentity();
  const { dealCategories } = useConfigurationContext();
  const translate = useTranslate();
  const { canAccess: canAccessSalesList, isPending } = useCanAccess({
    resource: "sales",
    action: "list",
  });

  if (!identity) return null;

  const dealFilters = [
    <SearchInput source="q" alwaysOn />,
    <ReferenceInput source="company_id" reference="companies">
      <AutocompleteInput
        label={false}
        placeholder={translate("resources.deals.fields.company_id")}
      />
    </ReferenceInput>,
    <WrapperField
      source="categories@cs"
      label="resources.deals.fields.category"
    >
      {/* deals having all the selected categories: categories@cs={a,b} */}
      <AutocompleteArrayInput
        source="categories@cs"
        label={false}
        placeholder={translate("resources.deals.fields.category")}
        choices={dealCategories}
        optionText="label"
        optionValue="value"
        format={(value?: string) =>
          value
            ? value
                .replace(/^\{|\}$/g, "")
                .split(",")
                .filter(Boolean)
            : []
        }
        // "" (not undefined) when emptied: the filter form drops empty
        // strings, but merges undefined away and would keep the old value
        parse={(values?: string[]) =>
          values?.length ? `{${values.join(",")}}` : ""
        }
      />
    </WrapperField>,
    ...(isPending
      ? []
      : [
          canAccessSalesList ? (
            <AccountManagerInput source="sales_id" alwaysOn />
          ) : (
            <OnlyMineInput source="sales_id" alwaysOn />
          ),
        ]),
  ];

  return (
    <List
      perPage={100}
      filter={{ "archived_at@is": null }}
      title={false}
      sort={{ field: "index", order: "DESC" }}
      filters={dealFilters}
      queryOptions={{ meta: { dealCategories } }}
      actions={<DealActions />}
      exporter={exporter}
      pagination={null}
    >
      <DealLayout />
    </List>
  );
};

const DealLayout = () => {
  const location = useLocation();
  const matchCreate = matchPath("/deals/create", location.pathname);
  const matchShow = matchPath("/deals/:id/show", location.pathname);
  const matchEdit = matchPath("/deals/:id", location.pathname);

  const { data, isPending, filterValues } = useListContext();
  useMigrateLegacyCategoryFilter();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters)
    return (
      <>
        <DealEmpty>
          <DealShow open={!!matchShow} id={matchShow?.params.id} />
          <DealArchivedList />
        </DealEmpty>
      </>
    );

  return (
    <div className="w-full">
      <DealListContent />
      <DealArchivedList />
      <DealCreate open={!!matchCreate} />
      <DealEdit open={!!matchEdit && !matchCreate} id={matchEdit?.params.id} />
      <DealShow open={!!matchShow} id={matchShow?.params.id} />
    </div>
  );
};

/**
 * Moves a stale single-category filter (stored list params, bookmarked URL) to
 * the categories filter once, so the Category input shows it and can clear it.
 * The data providers also map it, for the request sent before this runs.
 */
const useMigrateLegacyCategoryFilter = () => {
  const { filterValues, displayedFilters, setFilters } = useListContext();
  useEffect(() => {
    if (!filterValues || !("category" in filterValues)) return;
    const { filter } = mapLegacyCategoryFilter({ filter: filterValues });
    setFilters(
      filter,
      "categories@cs" in filter
        ? { ...displayedFilters, "categories@cs": true }
        : displayedFilters,
    );
  }, [filterValues, displayedFilters, setFilters]);
};

const DealActions = () => (
  <TopToolbar>
    <FilterButton />
    <DataImportButton resource="deals" />
    <ExportButton />
    <CreateButton label="resources.deals.action.new" />
  </TopToolbar>
);

/** Writes the per-category amounts in the `categories` column the import reads */
const exporter: Exporter<Deal> = (records) => {
  const deals = records.map(({ category_amounts, ...deal }) => ({
    ...deal,
    categories: formatCategoryAmounts(category_amounts),
  }));
  return jsonExport(deals, {}, (_err: any, csv: string) => {
    downloadCSV(csv, "deals");
  });
};

/**
 *
 * Used so that label of filters can be inferred for the select display,
 * but not be displayed when showing the input.
 */
const WrapperField = ({ children }: InputProps & { children: ReactNode }) =>
  children;

export default DealList;
