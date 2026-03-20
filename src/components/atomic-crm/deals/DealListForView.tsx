import { useCanAccess, useGetIdentity, useListContext } from "ra-core";
import { matchPath, Navigate, useLocation, useNavigate, useParams } from "react-router";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { ReferenceInput } from "@/components/admin/reference-input";
import { FilterButton } from "@/components/admin/filter-form";
import { SearchInput } from "@/components/admin/search-input";
import { SelectInput } from "@/components/admin/select-input";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { TopToolbar } from "../layout/TopToolbar";
import { DealArchivedList } from "./DealArchivedList";
import { DealCreate } from "./DealCreate";
import { DealEdit } from "./DealEdit";
import { DealEmpty } from "./DealEmpty";
import { DealListContent, DealListViewProvider } from "./DealListContent";
import { DealShow } from "./DealShow";
import { OnlyMineInput } from "./OnlyMineInput";

export const DealListForView = () => {
  const { viewId } = useParams<{ viewId: string }>();
  const { customViews, dealCategories } = useConfigurationContext();
  const { identity } = useGetIdentity();
  const { canAccess: isAdmin } = useCanAccess({
    resource: "configuration",
    action: "edit",
  });

  const view = customViews.find((v) => v.id === viewId);
  const currentSaleId = identity?.id as number | undefined;

  // Access check: admins always allowed; regular users must be in allowedUserIds (or it's open)
  const hasAccess =
    !identity || // still loading
    !view || // will 404
    isAdmin ||
    !view.allowedUserIds?.length ||
    (currentSaleId != null && view.allowedUserIds.includes(currentSaleId));

  if (identity && view && !hasAccess) {
    return <Navigate to="/deals" replace />;
  }

  if (!identity || !view) return null;

  const dealFilters = [
    <SearchInput source="q" alwaysOn />,
    <ReferenceInput source="company_id" reference="companies">
      <AutocompleteInput label={false} placeholder="Société" />
    </ReferenceInput>,
    <SelectInput
      source="category"
      emptyText="Catégorie"
      choices={dealCategories}
      optionText="label"
      optionValue="value"
    />,
    <OnlyMineInput source="sales_id" alwaysOn />,
  ];

  return (
    <DealListViewProvider value={{ initialVisibleStages: view.visibleStages, companyType: view.companyType }}>
      <List
        resource="deals"
        perPage={100}
        filter={{
          "archived_at@is": null,
          company_type: view.companyType,
        }}
        title={false}
        sort={{ field: "index", order: "DESC" }}
        filters={dealFilters}
        actions={<DealViewActions />}
        pagination={null}
      >
        <DealViewLayout />
      </List>
    </DealListViewProvider>
  );
};

const DealViewLayout = () => {
  const location = useLocation();
  const matchCreate = matchPath("/views/:viewId/create", location.pathname);
  const matchShow = matchPath("/views/:viewId/:id/show", location.pathname);
  const matchEdit = matchPath("/views/:viewId/:id", location.pathname);

  const { data, isPending, filterValues } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters)
    return (
      <>
        <DealEmpty>
          <DealCreate open={!!matchCreate} />
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

const DealViewActions = () => {
  const { viewId } = useParams<{ viewId: string }>();
  const navigate = useNavigate();
  return (
    <TopToolbar>
      <FilterButton />
      <ExportButton />
      <button
        className={buttonVariants({ variant: "outline" })}
        onClick={() => navigate(`/views/${viewId}/create`)}
      >
        <Plus />
        Nouvelle opportunité
      </button>
    </TopToolbar>
  );
};
