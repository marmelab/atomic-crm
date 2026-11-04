import {
  useCanAccess,
  useGetIdentity,
  useListContext,
  useStore,
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

import { DataImportButton } from "../dataImport/DataImportButton";
import { TopToolbar } from "../layout/TopToolbar";
import { AccountManagerInput } from "../sales/AccountManagerInput";
import { DealArchivedList } from "./DealArchivedList";
import { DealCreate } from "./DealCreate";
import { DealEdit } from "./DealEdit";
import { DealEmpty } from "./DealEmpty";
import { DealListContent } from "./DealListContent";
import { OnlyMineInput } from "./OnlyMineInput";
import { DealTableView } from "./DealTableView";
import { DealCompanyView } from "./DealCompanyView";
import {
  DealViewToggle,
  DEAL_VIEW_STORE_KEY,
  type DealViewMode,
} from "./DealViewToggle";

const DealList = () => {
  const { identity } = useGetIdentity();
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
      sort={{ field: "index", order: "DESC" }}
      filters={dealFilters}
      actions={<DealActions />}
      pagination={null}
    >
      <DealLayout />
    </List>
  );
};

const DealLayout = () => {
  const location = useLocation();
  const matchCreate = matchPath("/deals/create", location.pathname);
  const matchEdit = matchPath("/deals/:id", location.pathname);

  const { data, isPending, filterValues } = useListContext();
  const [viewMode] = useStore<DealViewMode>(DEAL_VIEW_STORE_KEY, "kanban");
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters)
    return (
      <>
        <DealEmpty>
          <DealArchivedList />
        </DealEmpty>
      </>
    );

  return (
    <div className="w-full">
      {viewMode === "list" ? (
        <DealTableView />
      ) : viewMode === "company" ? (
        <DealCompanyView />
      ) : (
        <DealListContent />
      )}
      <DealArchivedList />
      <DealCreate open={!!matchCreate} />
      <DealEdit open={!!matchEdit && !matchCreate} id={matchEdit?.params.id} />
    </div>
  );
};

const DealActions = () => (
  <TopToolbar>
    <FilterButton />
    <DealViewToggle />
    <DataImportButton resource="deals" />
    <ExportButton />
    <CreateButton label="resources.deals.action.new" />
  </TopToolbar>
);

export default DealList;
