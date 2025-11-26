import { useGetIdentity, useListContext } from "ra-core";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { ListPagination } from "@/components/admin/list-pagination";
import { SortButton } from "@/components/admin/sort-button";

import { TopToolbar } from "../layout/TopToolbar";
import { CompanyEmpty } from "./CompanyEmpty";
import { CompanyListFilter } from "./CompanyListFilter";
import { ImageList } from "./GridList";
import { useIsMobile } from "@/hooks/use-mobile";
import { SearchInput, TextField } from "@/components/admin";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import { Plus } from "lucide-react";
import { CompanyAvatar } from "./CompanyAvatar";
import { RecordsIterator } from "ra-core";
import { Card } from "@/components/ui/card";
import { useRecordContext } from "ra-core";
import { useReferenceManyFieldController } from "ra-core";

export const CompanyList = () => {
  const { identity } = useGetIdentity();
  const isMobile = useIsMobile();
  if (!identity) return null;
  return (
    <List
      title={false}
      perPage={25}
      sort={{ field: "name", order: "ASC" }}
      actions={<CompanyListActions />}
      pagination={<ListPagination rowsPerPageOptions={[10, 25, 50, 100]} />}
      filters={
        isMobile
          ? [
              <SearchInput
                source="q"
                alwaysOn
                className="w-full"
                placeholder="Name, sector"
              />,
            ]
          : undefined
      }
    >
      <CompanyListLayout />
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
              to={`/companies/${record.id}`}
            >
              <CompanyAvatar />
              <div className="flex flex-col grow">
                <TextField source="name" />
                <div className="flex items-center justify-between gap-2 text-sm text-gray-400">
                  <TextField source="sector" />
                  <div className="flex items-center gap-1">
                    <DealsCount />
                  </div>
                </div>
              </div>
            </Link>
          </li>
        )}
      />
    </ul>
  </Card>
);
/**
 * Necessary until we have a render prop on ReferenceManyCountBase
 */
const DealsCount = () => {
  const record = useRecordContext();
  const { isLoading, error, total } = useReferenceManyFieldController({
    page: 1,
    perPage: 1,
    record,
    reference: "deals",
    target: "company_id",
  });

  const body = isLoading
    ? ""
    : error
      ? "error"
      : `${total} ${total === 1 ? "deal" : "deals"}`;
  return <span>{body}</span>;
};

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
