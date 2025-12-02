import {
  InfiniteListBase,
  RecordsIterator,
  useGetIdentity,
  useListContext,
} from "ra-core";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List, ListView } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { SortButton } from "@/components/admin/sort-button";
import { useIsMobile } from "@/hooks/use-mobile";
import { TextField } from "@/components/admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router";
import { Plus } from "lucide-react";

import { TopToolbar } from "../layout/TopToolbar";
import { CompanyEmpty } from "./CompanyEmpty";
import { CompanyListFilter } from "./CompanyListFilter";
import { ImageList } from "./GridList";
import { CompanyAvatar } from "./CompanyAvatar";
import { ReferenceManyCount } from "../misc/ReferenceManyCount";
import { InfinitePagination } from "../misc/InfinitePagination";

export const CompanyList = () => {
  const { identity } = useGetIdentity();
  const isMobile = useIsMobile();
  if (!identity) return null;

  if (isMobile) {
    return (
      <InfiniteListBase>
        <ListView pagination={<InfinitePagination />} actions={false}>
          <CompanyListFilter />
          <CompanyListLayout />
        </ListView>
        <Button
          variant="default"
          size="icon"
          className="rounded-full fixed bottom-12 right-12 w-12 h-12"
          asChild
        >
          <Link to="/companies/create">
            <span className="sr-only">Create new company</span>
            <Plus />
          </Link>
        </Button>
      </InfiniteListBase>
    );
  }
  return (
    <List
      title={false}
      perPage={25}
      sort={{ field: "name", order: "ASC" }}
      actions={<CompanyListActions />}
      pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
    >
      <CompanyListLayout />
    </List>
  );
};

const CompanyListLayout = () => {
  const { data, isPending, filterValues } = useListContext();
  const hasFilters = filterValues && Object.keys(filterValues).length > 0;
  const isMobile = useIsMobile();

  if (isPending) return null;
  if (!data?.length && !hasFilters) return <CompanyEmpty />;

  return (
    <div className="w-full flex flex-row gap-8">
      {isMobile ? null : <CompanyListFilter />}
      <div className="flex flex-col flex-1 gap-4">
        {isMobile ? <CompanyMobileList /> : <ImageList />}
      </div>
    </div>
  );
};

const CompanyMobileList = () => (
  <Card className="p-2">
    <ul className="flex flex-col gap-4">
      <RecordsIterator
        render={(record) => (
          <li className="flex flex-col">
            <Link
              className="flex items-center gap-2"
              to={`/companies/${record.id}/show`}
            >
              <CompanyAvatar />
              <div className="flex flex-col grow">
                <div className="flex gap-1 items-baseline">
                  <TextField
                    source="name"
                    className="flex-1 inline-block truncate min-w-0"
                  />
                  <ReferenceManyCount
                    reference="deals"
                    target="company_id"
                    render={(total) => (
                      <span className="inline-block basis-1/5 -m-2 text-muted-foreground text-sm whitespace-nowrap">
                        {total} {total === 1 ? "deal" : "deals"}
                      </span>
                    )}
                  />
                </div>
                <TextField
                  className="flex items-center justify-between gap-2 text-sm text-muted-foreground"
                  source="sector"
                />
              </div>
            </Link>
          </li>
        )}
      />
    </ul>
  </Card>
);

const CompanyListActions = () => {
  const isMobile = useIsMobile();

  return (
    <TopToolbar>
      <SortButton fields={["name", "created_at", "nb_contacts"]} />
      {isMobile ? null : (
        <>
          <ExportButton />
          <CreateButton label="New Company" />
        </>
      )}
    </TopToolbar>
  );
};
