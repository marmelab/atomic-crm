import { useListContext, useCreatePath } from "ra-core";
import { Link } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ResizableHead,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Store,
  Heart,
  PartyPopper,
  Globe,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { CLIENT_COLUMNS } from "../misc/columnDefinitions";

import type { Client } from "../types";
import { ListAvatar } from "../misc/ListAvatar";
import {
  getClientDistinctBillingName,
  getClientBillingIdentityLines,
} from "./clientBilling";
import { clientTypeLabels, clientSourceLabels } from "./clientTypes";
import { ErrorMessage } from "../misc/ErrorMessage";
import {
  ListSelectAllCheckbox,
  ListRowCheckbox,
  MobileSelectableCard,
  ListBulkToolbar,
} from "../misc/ListBulkSelection";

export const ClientListContent = () => {
  const { data, isPending, error } = useListContext<Client>();
  const createPath = useCreatePath();
  const isMobile = useIsMobile();
  const { cv } = useColumnVisibility("clients", CLIENT_COLUMNS);
  const resize = useResizableColumns("clients");

  if (error) return <ErrorMessage />;
  if (isPending || !data) return null;

  if (isMobile) {
    return (
      <>
        <div className="flex flex-col divide-y px-2">
          {data.map((client) => (
            <MobileSelectableCard key={client.id} id={client.id}>
              <ClientMobileCard
                client={client}
                link={createPath({
                  resource: "clients",
                  type: "show",
                  id: client.id,
                })}
              />
            </MobileSelectableCard>
          ))}
        </div>
        <ListBulkToolbar />
      </>
    );
  }

  const { getWidth, onResizeStart, headerRef } = resize;
  return (
    <>
      <Table style={{ tableLayout: "fixed" }}>
        <TableHeader ref={headerRef}>
          <TableRow>
            <TableHead className="w-10">
              <ListSelectAllCheckbox />
            </TableHead>
            <ResizableHead
              colKey="name"
              width={getWidth("name")}
              onResizeStart={onResizeStart}
              className={cv("name")}
            >
              Nome / Ragione sociale
            </ResizableHead>
            <ResizableHead
              colKey="type"
              width={getWidth("type")}
              onResizeStart={onResizeStart}
              className={cv("type")}
            >
              Tipo
            </ResizableHead>
            <ResizableHead
              colKey="phone"
              width={getWidth("phone")}
              onResizeStart={onResizeStart}
              className={cv("phone", "hidden md:table-cell")}
            >
              Telefono
            </ResizableHead>
            <ResizableHead
              colKey="email"
              width={getWidth("email")}
              onResizeStart={onResizeStart}
              className={cv("email", "hidden md:table-cell")}
            >
              Email
            </ResizableHead>
            <ResizableHead
              colKey="source"
              width={getWidth("source")}
              onResizeStart={onResizeStart}
              className={cv("source", "hidden lg:table-cell")}
            >
              Fonte
            </ResizableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((client) => (
            <ClientRow
              key={client.id}
              client={client}
              cv={cv}
              createPath={createPath}
            />
          ))}
        </TableBody>
      </Table>
      <ListBulkToolbar />
    </>
  );
};

const ClientRow = ({
  client,
  cv,
  createPath,
}: {
  client: Client;
  cv: (key: string, extra?: string) => string | undefined;
  createPath: ReturnType<typeof useCreatePath>;
}) => (
  <TableRow className="cursor-pointer hover:bg-muted/50">
    <TableCell className="w-10">
      <ListRowCheckbox id={client.id} />
    </TableCell>
    <TableCell className={cv("name")}>
      <div className="flex items-start gap-3">
        <ClientIconAvatar
          type={client.client_type}
          imageUrl={client.logo_url}
        />
        <div className="space-y-1.5 min-w-0">
          <Link
            to={createPath({
              resource: "clients",
              type: "show",
              id: client.id,
            })}
            className="font-medium text-primary hover:underline block"
          >
            {client.name}
          </Link>
          {getClientDistinctBillingName(client) ? (
            <p className="text-xs text-muted-foreground">
              Fatturazione: {getClientDistinctBillingName(client)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1">
            {getClientBillingIdentityLines(client).map((line) => (
              <Badge key={line} variant="outline" className="text-[11px]">
                {line}
              </Badge>
            ))}
            {client.billing_city ? (
              <Badge variant="outline" className="text-[11px]">
                {client.billing_city}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    </TableCell>
    <TableCell className={cv("type")}>
      <ClientTypeBadge type={client.client_type} />
    </TableCell>
    <TableCell
      className={cv("phone", "hidden md:table-cell text-muted-foreground")}
    >
      {client.phone}
    </TableCell>
    <TableCell
      className={cv("email", "hidden md:table-cell text-muted-foreground")}
    >
      {client.email}
    </TableCell>
    <TableCell
      className={cv(
        "source",
        "hidden lg:table-cell text-muted-foreground text-sm",
      )}
    >
      {client.source ? clientSourceLabels[client.source] : ""}
    </TableCell>
  </TableRow>
);

/* ---- Mobile card ---- */
const ClientMobileCard = ({
  client,
  link,
}: {
  client: Client;
  link: string;
}) => (
  <Link to={link} className="flex flex-col gap-1 px-1 py-3 active:bg-muted/50">
    <span className="text-base font-bold">{client.name}</span>
    <div className="flex items-center gap-2">
      <ClientTypeBadge type={client.client_type} />
      {client.billing_city && (
        <span className="text-xs text-muted-foreground">
          {client.billing_city}
        </span>
      )}
    </div>
    {(client.email || client.phone) && (
      <span className="text-xs text-muted-foreground">
        {client.email || client.phone}
      </span>
    )}
  </Link>
);

const clientTypeConfig: Record<
  string,
  { icon: LucideIcon; color: string; bg: string }
> = {
  produzione_tv: {
    icon: Building2,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
  },
  azienda_locale: {
    icon: Store,
    color: "text-green-600",
    bg: "bg-green-50 border-green-200",
  },
  privato_wedding: {
    icon: Heart,
    color: "text-rose-600",
    bg: "bg-rose-50 border-rose-200",
  },
  privato_evento: {
    icon: PartyPopper,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
  },
  web: {
    icon: Globe,
    color: "text-violet-600",
    bg: "bg-violet-50 border-violet-200",
  },
};

export const ClientTypeBadge = ({ type }: { type: string }) => {
  const config = clientTypeConfig[type];
  if (!config) {
    return <Badge variant="outline">{clientTypeLabels[type] ?? type}</Badge>;
  }
  const Icon = config.icon;
  return (
    <Badge
      variant="outline"
      className={cn("inline-flex items-center gap-1.5 px-2 py-0.5", config.bg)}
    >
      <Icon className={cn("h-3 w-3", config.color)} />
      <span className={config.color}>{clientTypeLabels[type] ?? type}</span>
    </Badge>
  );
};

/* ---- Client Icon Avatar ---- */
const ClientIconAvatar = ({
  type,
  imageUrl,
}: {
  type: string;
  imageUrl?: string | null;
}) => {
  const config = clientTypeConfig[type];
  return (
    <ListAvatar
      imageUrl={imageUrl}
      icon={config?.icon ?? User}
      iconColor={config?.color ?? "text-gray-500"}
      bgClass={config?.bg ?? "bg-gray-50 border-gray-200"}
    />
  );
};
