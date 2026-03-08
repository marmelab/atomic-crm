import { useListContext, useCreatePath, useGetOne } from "ra-core";
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
import { Wallet, CheckCircle, Clock, AlertCircle, Euro } from "lucide-react";
import { cn } from "@/lib/utils";

import type { Payment } from "../types";
import { paymentTypeLabels, paymentStatusLabels } from "./paymentTypes";
import { ErrorMessage } from "../misc/ErrorMessage";
import {
  ListSelectAllCheckbox,
  ListRowCheckbox,
  MobileSelectableCard,
  ListBulkToolbar,
} from "../misc/ListBulkSelection";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { PAYMENT_COLUMNS } from "../misc/columnDefinitions";

const eur = (n: number) =>
  n.toLocaleString("it-IT", { minimumFractionDigits: 2 });

const paymentTypeIcons: Record<string, LucideIcon> = {
  acconto: Wallet,
  saldo: CheckCircle,
  altro: Euro,
};

const paymentTypeColors: Record<string, string> = {
  acconto: "text-blue-600 bg-blue-50 border-blue-200",
  saldo: "text-green-600 bg-green-50 border-green-200",
  altro: "text-slate-600 bg-slate-50 border-slate-200",
};

const PaymentIconAvatar = ({ type }: { type: string }) => {
  const Icon = paymentTypeIcons[type] ?? Euro;
  const colorClass = paymentTypeColors[type]?.split(" ")[0] ?? "text-slate-600";
  const bgClass =
    paymentTypeColors[type]?.split(" ").slice(1).join(" ") ??
    "bg-slate-50 border-slate-200";

  return (
    <div
      className={cn(
        "flex-shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center",
        bgClass,
      )}
    >
      <Icon className={cn("h-4 w-4", colorClass)} />
    </div>
  );
};

export const PaymentListContent = () => {
  const { data, isPending, error } = useListContext<Payment>();
  const createPath = useCreatePath();
  const isMobile = useIsMobile();
  const { cv } = useColumnVisibility("payments", PAYMENT_COLUMNS);
  const { getWidth, onResizeStart, headerRef } =
    useResizableColumns("payments");

  if (error) return <ErrorMessage />;
  if (isPending || !data) return null;

  if (isMobile) {
    return (
      <>
        <div className="flex flex-col divide-y px-2">
          {data.map((payment) => (
            <MobileSelectableCard key={payment.id} id={payment.id}>
              <PaymentMobileCard
                payment={payment}
                link={createPath({
                  resource: "payments",
                  type: "show",
                  id: payment.id,
                })}
              />
            </MobileSelectableCard>
          ))}
        </div>
        <ListBulkToolbar allowDelete />
      </>
    );
  }

  return (
    <>
      <Table style={{ tableLayout: "fixed" }}>
        <TableHeader ref={headerRef}>
          <TableRow>
            <TableHead className="w-10">
              <ListSelectAllCheckbox />
            </TableHead>
            <ResizableHead
              colKey="date"
              width={getWidth("date")}
              onResizeStart={onResizeStart}
              className={cv("date")}
            >
              Data
            </ResizableHead>
            <ResizableHead
              colKey="client"
              width={getWidth("client")}
              onResizeStart={onResizeStart}
              className={cv("client")}
            >
              Cliente
            </ResizableHead>
            <ResizableHead
              colKey="project"
              width={getWidth("project")}
              onResizeStart={onResizeStart}
              className={cv("project", "hidden lg:table-cell")}
            >
              Progetto
            </ResizableHead>
            <ResizableHead
              colKey="quote"
              width={getWidth("quote")}
              onResizeStart={onResizeStart}
              className={cv("quote", "hidden xl:table-cell")}
            >
              Preventivo
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
              colKey="amount"
              width={getWidth("amount")}
              onResizeStart={onResizeStart}
              className={cv("amount", "text-right")}
            >
              Importo
            </ResizableHead>
            <ResizableHead
              colKey="invoice_ref"
              width={getWidth("invoice_ref")}
              onResizeStart={onResizeStart}
              className={cv("invoice_ref", "hidden md:table-cell")}
            >
              Rif. Fattura
            </ResizableHead>
            <ResizableHead
              colKey="status"
              width={getWidth("status")}
              onResizeStart={onResizeStart}
              className={cv("status")}
            >
              Stato
            </ResizableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((payment) => (
            <PaymentRow
              key={payment.id}
              payment={payment}
              link={createPath({
                resource: "payments",
                type: "show",
                id: payment.id,
              })}
            />
          ))}
        </TableBody>
      </Table>
      <ListBulkToolbar allowDelete />
    </>
  );
};

/* ---- Mobile card ---- */
const PaymentMobileCard = ({
  payment,
  link,
}: {
  payment: Payment;
  link: string;
}) => {
  const { data: client } = useGetOne("clients", { id: payment.client_id });

  return (
    <Link
      to={link}
      className="flex flex-col gap-1 px-1 py-3 active:bg-muted/50"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {payment.payment_date
            ? new Date(payment.payment_date).toLocaleDateString("it-IT")
            : "--"}
        </span>
        <PaymentStatusBadge status={payment.status} />
      </div>
      <span className="text-base font-bold">{client?.name ?? ""}</span>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {paymentTypeLabels[payment.payment_type] ?? payment.payment_type}
        </span>
        <span className="text-sm font-semibold tabular-nums">
          EUR {eur(payment.amount)}
        </span>
      </div>
    </Link>
  );
};

/* ---- Desktop table row ---- */
const PaymentRow = ({ payment, link }: { payment: Payment; link: string }) => {
  const { cv } = useColumnVisibility("payments", PAYMENT_COLUMNS);
  const { data: client } = useGetOne("clients", { id: payment.client_id });
  const { data: project } = useGetOne(
    "projects",
    {
      id: payment.project_id ?? undefined,
    },
    {
      enabled: !!payment.project_id,
    },
  );
  const { data: quote } = useGetOne(
    "quotes",
    {
      id: payment.quote_id ?? undefined,
    },
    {
      enabled: !!payment.quote_id,
    },
  );

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50">
      <TableCell className="w-10">
        <ListRowCheckbox id={payment.id} />
      </TableCell>
      <TableCell className={cv("date", "text-sm")}>
        <Link to={link} className="text-primary hover:underline">
          {payment.payment_date
            ? new Date(payment.payment_date).toLocaleDateString("it-IT")
            : "--"}
        </Link>
      </TableCell>
      <TableCell className={cv("client", "text-sm text-muted-foreground")}>
        {client?.name ?? ""}
      </TableCell>
      <TableCell
        className={cv(
          "project",
          "hidden lg:table-cell text-sm text-muted-foreground",
        )}
      >
        {project?.name ?? ""}
      </TableCell>
      <TableCell
        className={cv(
          "quote",
          "hidden xl:table-cell text-sm text-muted-foreground",
        )}
      >
        {quote?.description ?? ""}
      </TableCell>
      <TableCell className={cv("type", "text-sm")}>
        <div className="flex items-center gap-2">
          <PaymentIconAvatar type={payment.payment_type} />
          <span>
            {paymentTypeLabels[payment.payment_type] ?? payment.payment_type}
          </span>
        </div>
      </TableCell>
      <TableCell className={cv("amount", "text-right text-sm font-medium")}>
        EUR {eur(payment.amount)}
      </TableCell>
      <TableCell
        className={cv(
          "invoice_ref",
          "hidden md:table-cell text-sm text-muted-foreground",
        )}
      >
        {payment.invoice_ref ?? ""}
      </TableCell>
      <TableCell className={cv("status")}>
        <PaymentStatusBadge status={payment.status} />
      </TableCell>
    </TableRow>
  );
};

/* ---- Status badge ---- */
const statusConfig: Record<
  string,
  { icon: LucideIcon; color: string; bg: string }
> = {
  ricevuto: {
    icon: CheckCircle,
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
  },
  in_attesa: {
    icon: Clock,
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
  },
  scaduto: {
    icon: AlertCircle,
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
  },
};

export const PaymentStatusBadge = ({ status }: { status: string }) => {
  const config = statusConfig[status];
  if (!config) {
    return (
      <Badge variant="outline">{paymentStatusLabels[status] ?? status}</Badge>
    );
  }
  const Icon = config.icon;
  return (
    <Badge
      variant="outline"
      className={cn("inline-flex items-center gap-1", config.bg)}
    >
      <Icon className={cn("h-3 w-3", config.color)} />
      <span className={config.color}>
        {paymentStatusLabels[status] ?? status}
      </span>
    </Badge>
  );
};
