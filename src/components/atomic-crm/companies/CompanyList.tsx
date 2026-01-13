import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { SortButton } from "@/components/admin/sort-button";
import { InfiniteListBase, useGetIdentity, useListContext } from "ra-core";

import { useIsMobile } from "@/hooks/use-mobile";
import { TopToolbar } from "../layout/TopToolbar";
import { MobileHeader } from "../layout/MobileHeader";
import { InfinitePagination } from "../misc/InfinitePagination";
import { CompanyEmpty } from "./CompanyEmpty";
import { CompanyListFilter } from "./CompanyListFilter";
import { ImageList } from "./GridList";

export const CompanyList = () => {
  const isMobile = useIsMobile();
  return isMobile ? <CompanyListMobile /> : <CompanyListDesktop />;
};

const CompanyListDesktop = () => {
  const { identity } = useGetIdentity();

  if (!identity) return null;

  return (
    <List
      title={false}
      perPage={25}
      sort={{ field: "name", order: "ASC" }}
      actions={<CompanyListActions />}
      pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
    >
      <DesktopCompanyListLayout />
    </List>
  );
};

const CompanyListMobile = () => {
  const { identity } = useGetIdentity();

  if (!identity) return null;

  return (
    <InfiniteListBase perPage={25} sort={{ field: "name", order: "ASC" }}>
      <MobileCompanyListLayout />
      <div className="flex justify-center">
        <InfinitePagination />
      </div>
    </InfiniteListBase>
  );
};

const DesktopCompanyListLayout = () => {
  const { data, isPending, filterValues } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;
  if (!data?.length && !hasFilters) return <CompanyEmpty />;

  return (
    <div className="w-full flex flex-row gap-8">
      <CompanyListFilter />
      <div className="flex flex-col flex-1 gap-4">
        <ImageList />
      </div>
    </div>
  );
};

const MobileCompanyListLayout = () => {
  const { data, isPending, filterValues } = useListContext();

  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;

  if (!data?.length && !hasFilters) return <CompanyEmpty />;

  return (
    <>
      <MobileHeader>
        <CompanyListFilter />
      </MobileHeader>
        <ImageList />
    </>
  );
};

const CompanyListActions = () => {
  return (
    <TopToolbar>
      <SortButton fields={["name", "created_at", "nb_contacts"]} />
      <ExportButton />
      <CreateButton label="New Company" />
    </TopToolbar>
  );
};
