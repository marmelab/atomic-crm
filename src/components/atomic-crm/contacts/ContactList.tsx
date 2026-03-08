import { CreateButton } from "@/components/admin/create-button";
import { List } from "@/components/admin/list";
import { SortButton } from "@/components/admin/sort-button";
import { useCreatePath, useGetMany, useListContext } from "ra-core";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  ResizableHead,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";

import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { useResizableColumns } from "@/hooks/useResizableColumns";

import type { Client, Contact } from "../types";
import { TopToolbar } from "../layout/TopToolbar";
import { MobilePageTitle } from "../layout/MobilePageTitle";
import { ErrorMessage } from "../misc/ErrorMessage";
import { CONTACT_COLUMNS } from "../misc/columnDefinitions";
import { ColumnVisibilityButton } from "../misc/ColumnVisibilityButton";
import {
  ListSelectAllCheckbox,
  MobileSelectableCard,
  ListBulkToolbar,
} from "../misc/ListBulkSelection";
import { compareContactsForClientContext } from "./contactRecord";
import { ContactMobileCard } from "./ContactMobileCard";
import { ContactRow } from "./ContactRow";

export const ContactList = () => {
  const { cv, columns, visibleKeys, toggleColumn } = useColumnVisibility(
    "contacts",
    CONTACT_COLUMNS,
  );

  return (
    <List
      title={false}
      actions={
        <ContactListActions
          columns={columns}
          visibleKeys={visibleKeys}
          toggleColumn={toggleColumn}
        />
      }
      perPage={25}
      sort={{ field: "updated_at", order: "DESC" }}
    >
      <ContactListLayout cv={cv} />
    </List>
  );
};

const ContactListActions = ({
  columns,
  visibleKeys,
  toggleColumn,
}: {
  columns: typeof CONTACT_COLUMNS;
  visibleKeys: string[];
  toggleColumn: (key: string) => void;
}) => {
  const isMobile = useIsMobile();

  return (
    <TopToolbar className={isMobile ? "justify-center" : undefined}>
      <SortButton fields={["last_name", "first_name", "updated_at"]} />
      <ColumnVisibilityButton
        columns={columns}
        visibleKeys={visibleKeys}
        toggleColumn={toggleColumn}
      />
      <CreateButton />
    </TopToolbar>
  );
};

const ContactListLayout = ({
  cv,
}: {
  cv: (key: string, extra?: string) => string | undefined;
}) => {
  const { data: rawData, isPending, error } = useListContext<Contact>();
  const createPath = useCreatePath();
  const isMobile = useIsMobile();
  const { getWidth, onResizeStart, headerRef } = useResizableColumns("contacts");
  const data = Array.isArray(rawData) ? rawData : Object.values(rawData ?? {});
  const clientIds = [
    ...new Set(data.map((contact) => contact.client_id).filter(Boolean)),
  ];
  const { data: clients } = useGetMany<Client>(
    "clients",
    { ids: clientIds as string[] },
    { enabled: !isPending && clientIds.length > 0 },
  );

  if (error) {
    return <ErrorMessage />;
  }

  if (isPending) {
    return null;
  }

  const clientById = new Map(
    (clients ?? []).map((client) => [String(client.id), client.name]),
  );
  const sortedContacts = [...data].sort(compareContactsForClientContext);

  if (data.length === 0) {
    return (
      <>
        <MobilePageTitle title="Referenti" />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground mb-4">Nessun referente</p>
          <CreateButton />
        </div>
      </>
    );
  }

  if (isMobile) {
    return (
      <>
        <MobilePageTitle title="Referenti" />
        <div className="mt-4 flex flex-col divide-y px-2">
          {sortedContacts.map((contact) => (
            <MobileSelectableCard key={contact.id} id={contact.id}>
              <ContactMobileCard
                contact={contact}
                link={createPath({
                  resource: "contacts",
                  type: "show",
                  id: contact.id,
                })}
              />
            </MobileSelectableCard>
          ))}
        </div>
        <ListBulkToolbar />
      </>
    );
  }

  return (
    <>
      <MobilePageTitle title="Referenti" />
      <div className="mt-4">
        <Table style={{ tableLayout: "fixed" }}>
          <TableHeader ref={headerRef}>
            <TableRow>
              <TableHead className="w-10">
                <ListSelectAllCheckbox />
              </TableHead>
              <ResizableHead colKey="name" width={getWidth("name")} onResizeStart={onResizeStart} className={cv("name")}>Referente</ResizableHead>
              <ResizableHead colKey="role" width={getWidth("role")} onResizeStart={onResizeStart} className={cv("role")}>Ruolo</ResizableHead>
              <ResizableHead colKey="contacts_info" width={getWidth("contacts_info")} onResizeStart={onResizeStart} className={cv("contacts_info", "hidden md:table-cell")}>Contatti</ResizableHead>
              <ResizableHead colKey="client" width={getWidth("client")} onResizeStart={onResizeStart} className={cv("client", "hidden lg:table-cell")}>Cliente</ResizableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedContacts.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                clientName={
                  contact.client_id
                    ? clientById.get(String(contact.client_id))
                    : null
                }
                link={createPath({
                  resource: "contacts",
                  type: "show",
                  id: contact.id,
                })}
                cv={cv}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      <ListBulkToolbar />
    </>
  );
};
