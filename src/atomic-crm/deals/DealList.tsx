import {
  AutocompleteInput,
  CreateButton,
  ExportButton,
  List,
  ReferenceInput,
  FilterButton,
  SearchInput,
  SelectInput,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/admin";
import {
  Translate,
  useGetIdentity,
  useListContext,
  useGetResourceLabel,
} from "ra-core";
import { Link, matchPath, useLocation } from "react-router";

import { useConfigurationContext } from "../root/ConfigurationContext";
import { TopToolbar } from "../layout/TopToolbar";
import { DealArchivedList } from "./DealArchivedList";
import { DealCreate } from "./DealCreate";
import { DealEdit } from "./DealEdit";
import { DealEmpty } from "./DealEmpty";
import { DealListContent } from "./DealListContent";
import { DealShow } from "./DealShow";
import { OnlyMineInput } from "./OnlyMineInput";

const DealList = () => {
  const { identity } = useGetIdentity();
  const getResourceLabel = useGetResourceLabel();
  const resourceLabel = getResourceLabel("deals", 2);
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
      filter={{
        "archived_at@is": null,
      }}
      title={false}
      sort={{ field: "index", order: "DESC" }}
      filters={dealFilters}
      actions={<DealActions />}
      pagination={null}
    >
      <Breadcrumb>
        <BreadcrumbItem>
          <Link to="/">
            <Translate i18nKey="ra.page.dashboard">Home</Translate>
          </Link>
        </BreadcrumbItem>
        <BreadcrumbPage>{resourceLabel}</BreadcrumbPage>
      </Breadcrumb>
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

const DealActions = () => {
  return (
    <TopToolbar>
      <FilterButton />
      <ExportButton />
      <CreateButton label="New Deal" />
    </TopToolbar>
  );
};

export default DealList;
