import {
  AutocompleteInput,
  CreateButton,
  ExportButton,
  List,
  ReferenceInput,
  FilterButton,
  SearchInput,
  SelectInput,
} from "@/components/admin";
import { useGetIdentity, useListContext } from "ra-core";
import { matchPath, useLocation } from "react-router";
import { useConfigurationContext } from "@/components/atomic-crm/root/ConfigurationContext";
import { TopToolbar } from "@/components/atomic-crm/layout/TopToolbar";
import { DealArchivedList } from "@/components/atomic-crm/deals/DealArchivedList";
import { DealCreate } from "@/components/atomic-crm/deals/DealCreate";
import { DealEdit } from "@/components/atomic-crm/deals/DealEdit";
import { DealEmpty } from "@/components/atomic-crm/deals/DealEmpty";
import { DealListContent } from "@/components/atomic-crm/deals/DealListContent";
import { DealShow } from "@/components/atomic-crm/deals/DealShow";
import { OnlyMineInput } from "@/components/atomic-crm/deals/OnlyMineInput";

const DealList = () => {
  const { identity } = useGetIdentity();
  const { dealCategories } = useConfigurationContext();

  if (!identity) return null;

  const dealFilters = [
    <SearchInput source="q" alwaysOn />,
    <ReferenceInput source="company_id" reference="companies">
      <AutocompleteInput label={false} placeholder="Company" />
    </ReferenceInput>,
    <SelectInput
      source="category"
      emptyText="Category"
      choices={dealCategories.map((type) => ({ id: type, name: type }))}
    />,
    <OnlyMineInput source="sales_id" alwaysOn />,
  ];

  return (
    <List
      perPage={100}
      filter={{ "archived_at@is": null }}
      title={false}
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
  const matchShow = matchPath("/deals/:id/show", location.pathname);
  const matchEdit = matchPath("/deals/:id", location.pathname);

  const { data, isPending, filterValues } = useListContext();
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

const DealActions = () => (
  <TopToolbar>
    <FilterButton />
    <ExportButton />
    <CreateButton label="New Deal" />
  </TopToolbar>
);

export default DealList;
