import { useGetIdentity, useListContext } from "ra-core";
import { Link, matchPath, useLocation } from "react-router";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { CreateButton } from "@/components/admin/create-button";
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
import { DealListContent } from "./DealListContent";
import { DealShow } from "./DealShow";
import { OnlyMineInput } from "./OnlyMineInput";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const DealList = () => {
  const { identity } = useGetIdentity();
  const { dealCategories } = useConfigurationContext();
  const isMobile = useIsMobile();

  if (!identity) return null;

  const dealFilters = [<SearchInput source="q" alwaysOn />];

  if (!isMobile) {
    dealFilters.push(
      <ReferenceInput source="company_id" reference="companies">
        <AutocompleteInput label={false} placeholder="Company" />
      </ReferenceInput>,
      <SelectInput
        source="category"
        emptyText="Category"
        choices={dealCategories.map((type) => ({ id: type, name: type }))}
      />,
      <OnlyMineInput source="sales_id" alwaysOn />,
    );
  }

  return (
    <List
      perPage={100}
      filter={{ "archived_at@is": null }}
      title={false}
      sort={{ field: "index", order: "DESC" }}
      filters={dealFilters}
      actions={isMobile ? false : <DealActions />}
      pagination={null}
    >
      <DealLayout />
      <Button
        variant="default"
        size="icon"
        className="rounded-full fixed bottom-12 right-12 w-12 h-12"
        asChild
      >
        <Link to="/deals/create">
          <span className="sr-only">Create new deal</span>
          <Plus />
        </Link>
      </Button>
    </List>
  );
};

const DealLayout = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const matchCreate =
    !isMobile && matchPath("/deals/create", location.pathname);
  const matchShow =
    !isMobile && matchPath("/deals/:id/show", location.pathname);
  const matchEdit = !isMobile && matchPath("/deals/:id", location.pathname);

  const { data, isPending, filterValues } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters)
    return (
      <>
        <DealEmpty>
          <DealShow
            open={!!matchShow}
            id={matchShow ? matchShow?.params.id : undefined}
          />
          <DealArchivedList />
        </DealEmpty>
      </>
    );

  return (
    <div className="w-full">
      <DealListContent />
      <DealArchivedList />
      <DealCreate open={!!matchCreate} />
      <DealEdit
        open={!!matchEdit && !matchCreate}
        id={matchEdit ? matchEdit?.params.id : undefined}
      />
      <DealShow
        open={!!matchShow}
        id={matchShow ? matchShow?.params.id : undefined}
      />
    </div>
  );
};

const DealActions = () => (
  <TopToolbar>
    <FilterButton />
    <ExportButton />
    <CreateButton label="New Deal" />
  </TopToolbar>
);

export default DealList;
