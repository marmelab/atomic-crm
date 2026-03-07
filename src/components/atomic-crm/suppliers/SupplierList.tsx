import { useListContext, useCreatePath } from "ra-core";
import { Link } from "react-router";
import { CreateButton } from "@/components/admin/create-button";
import { List } from "@/components/admin/list";
import { SortButton } from "@/components/admin/sort-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

import type { Supplier } from "../types";
import { TopToolbar } from "../layout/TopToolbar";
import { MobilePageTitle } from "../layout/MobilePageTitle";
import { ErrorMessage } from "../misc/ErrorMessage";
import {
  ListSelectAllCheckbox,
  ListRowCheckbox,
  MobileSelectableCard,
  ListBulkToolbar,
} from "../misc/ListBulkSelection";
import {
  SupplierListFilter,
  SupplierMobileFilter,
} from "./SupplierListFilter";

export const SupplierList = () => (
  <List
    title={false}
    actions={<SupplierListActions />}
    perPage={25}
    sort={{ field: "name", order: "ASC" }}
  >
    <SupplierListLayout />
  </List>
);

const SupplierListActions = () => {
  const isMobile = useIsMobile();
  return (
    <TopToolbar className={isMobile ? "justify-center" : undefined}>
      {isMobile && <SupplierMobileFilter />}
      <SortButton fields={["name", "created_at"]} />
      <CreateButton />
    </TopToolbar>
  );
};

const SupplierListLayout = () => {
  const { data, isPending, error } = useListContext<Supplier>();
  const createPath = useCreatePath();
  const isMobile = useIsMobile();

  if (error) return <ErrorMessage />;
  if (isPending) return null;

  if (isMobile) {
    return (
      <>
        <MobilePageTitle title="Fornitori" />
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground mb-4">Nessun fornitore</p>
            <CreateButton />
          </div>
        ) : (
          <div className="mt-4 flex flex-col divide-y px-2">
            {data.map((supplier) => (
              <MobileSelectableCard key={supplier.id} id={supplier.id}>
                <SupplierMobileCard
                  supplier={supplier}
                  link={createPath({
                    resource: "suppliers",
                    type: "show",
                    id: supplier.id,
                  })}
                />
              </MobileSelectableCard>
            ))}
          </div>
        )}
        <ListBulkToolbar allowDelete />
      </>
    );
  }

  return (
    <>
      <MobilePageTitle title="Fornitori" />
      <div className="mt-4 flex flex-col md:flex-row md:gap-8">
        <SupplierListFilter />
        <div className="w-full flex flex-col gap-4">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground mb-4">Nessun fornitore</p>
              <CreateButton />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <ListSelectAllCheckbox />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">
                    P.IVA
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    Telefono
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Email
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((supplier) => (
                  <SupplierRow
                    key={supplier.id}
                    supplier={supplier}
                    link={createPath({
                      resource: "suppliers",
                      type: "show",
                      id: supplier.id,
                    })}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
      <ListBulkToolbar allowDelete />
    </>
  );
};

const SupplierIconAvatar = () => (
  <div
    className={cn(
      "flex-shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center",
      "bg-indigo-50 border-indigo-200",
    )}
  >
    <Building2 className="h-4 w-4 text-indigo-600" />
  </div>
);

const SupplierRow = ({
  supplier,
  link,
}: {
  supplier: Supplier;
  link: string;
}) => (
  <TableRow className="cursor-pointer hover:bg-muted/50">
    <TableCell className="w-10">
      <ListRowCheckbox id={supplier.id} />
    </TableCell>
    <TableCell>
      <div className="flex items-center gap-3">
        <SupplierIconAvatar />
        <Link to={link} className="font-medium text-primary hover:underline">
          {supplier.name}
        </Link>
      </div>
    </TableCell>
    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
      {supplier.vat_number ?? ""}
    </TableCell>
    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
      {supplier.phone ?? ""}
    </TableCell>
    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
      {supplier.email ?? ""}
    </TableCell>
  </TableRow>
);

const SupplierMobileCard = ({
  supplier,
  link,
}: {
  supplier: Supplier;
  link: string;
}) => (
  <Link to={link} className="flex flex-col gap-1 px-1 py-3 active:bg-muted/50">
    <div className="flex items-center gap-3">
      <SupplierIconAvatar />
      <div className="flex-1 min-w-0">
        <span className="text-base font-bold truncate block">
          {supplier.name}
        </span>
        {supplier.vat_number && (
          <span className="text-xs text-muted-foreground">
            P.IVA: {supplier.vat_number}
          </span>
        )}
      </div>
    </div>
    {(supplier.phone || supplier.email) && (
      <span className="text-xs text-muted-foreground">
        {[supplier.phone, supplier.email].filter(Boolean).join(" · ")}
      </span>
    )}
  </Link>
);
