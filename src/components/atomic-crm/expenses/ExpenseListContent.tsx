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
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";

import type { Expense } from "../types";
import { expenseTypeLabels } from "./expenseTypes";
import { ErrorMessage } from "../misc/ErrorMessage";
import { useConfigurationContext } from "../root/ConfigurationContext";
import {
  ListSelectAllCheckbox,
  ListRowCheckbox,
  MobileSelectableCard,
  ListBulkToolbar,
} from "../misc/ListBulkSelection";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import { EXPENSE_COLUMNS } from "../misc/columnDefinitions";
import { ExpenseIconAvatar, computeTotal, eur } from "./expenseListHelpers";
import { ExpenseMobileCard } from "./ExpenseMobileCard";

export const ExpenseListContent = () => {
  const { data, isPending, error } = useListContext<Expense>();
  const { operationalConfig } = useConfigurationContext();
  const createPath = useCreatePath();
  const isMobile = useIsMobile();
  const { cv } = useColumnVisibility("expenses", EXPENSE_COLUMNS);
  const { getWidth, onResizeStart, headerRef } = useResizableColumns("expenses");

  if (error) return <ErrorMessage />;
  if (isPending || !data) return null;

  if (isMobile) {
    return (
      <>
        <div className="flex flex-col divide-y px-2">
          {data.map((expense) => (
            <MobileSelectableCard key={expense.id} id={expense.id}>
              <ExpenseMobileCard
                expense={expense}
                defaultKmRate={operationalConfig.defaultKmRate}
                link={createPath({
                  resource: "expenses",
                  type: "show",
                  id: expense.id,
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
            <ResizableHead colKey="date" width={getWidth("date")} onResizeStart={onResizeStart} className={cv("date")}>Data</ResizableHead>
            <ResizableHead colKey="type" width={getWidth("type")} onResizeStart={onResizeStart} className={cv("type")}>Tipo</ResizableHead>
            <ResizableHead colKey="client" width={getWidth("client")} onResizeStart={onResizeStart} className={cv("client", "hidden md:table-cell")}>Cliente</ResizableHead>
            <ResizableHead colKey="supplier" width={getWidth("supplier")} onResizeStart={onResizeStart} className={cv("supplier", "hidden md:table-cell")}>Fornitore</ResizableHead>
            <ResizableHead colKey="project" width={getWidth("project")} onResizeStart={onResizeStart} className={cv("project")}>Progetto</ResizableHead>
            <ResizableHead colKey="km" width={getWidth("km")} onResizeStart={onResizeStart} className={cv("km", "text-right hidden md:table-cell")}>Km</ResizableHead>
            <ResizableHead colKey="total" width={getWidth("total")} onResizeStart={onResizeStart} className={cv("total", "text-right")}>Totale EUR</ResizableHead>
            <ResizableHead colKey="description" width={getWidth("description")} onResizeStart={onResizeStart} className={cv("description", "hidden lg:table-cell")}>Descrizione</ResizableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((expense) => (
            <ExpenseRow
              key={expense.id}
              defaultKmRate={operationalConfig.defaultKmRate}
              expense={expense}
              link={createPath({
                resource: "expenses",
                type: "show",
                id: expense.id,
              })}
            />
          ))}
        </TableBody>
      </Table>
      <ListBulkToolbar allowDelete />
    </>
  );
};

const ExpenseRow = ({
  expense,
  link,
  defaultKmRate,
}: {
  expense: Expense;
  link: string;
  defaultKmRate: number;
}) => {
  const { cv } = useColumnVisibility("expenses", EXPENSE_COLUMNS);
  const { data: project } = useGetOne(
    "projects",
    {
      id: expense.project_id ?? undefined,
    },
    {
      enabled: !!expense.project_id,
    },
  );
  const { data: client } = useGetOne(
    "clients",
    {
      id: expense.client_id ?? undefined,
    },
    {
      enabled: !!expense.client_id,
    },
  );
  const { data: supplier } = useGetOne(
    "suppliers",
    {
      id: expense.supplier_id ?? undefined,
    },
    {
      enabled: !!expense.supplier_id,
    },
  );
  const total = computeTotal(expense, defaultKmRate);

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50">
      <TableCell className="w-10">
        <ListRowCheckbox id={expense.id} />
      </TableCell>
      <TableCell className={cv("date", "text-sm")}>
        <Link to={link} className="text-primary hover:underline">
          {new Date(expense.expense_date).toLocaleDateString("it-IT")}
        </Link>
      </TableCell>
      <TableCell className={cv("type", "text-sm")}>
        <div className="flex items-center gap-2">
          <ExpenseIconAvatar type={expense.expense_type} />
          {expense.expense_type === "credito_ricevuto" ? (
            <Badge variant="secondary" className="text-green-700">
              Credito
            </Badge>
          ) : (
            <span>
              {expenseTypeLabels[expense.expense_type] ?? expense.expense_type}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className={cv("client", "text-sm text-muted-foreground hidden md:table-cell")}>
        {client?.name ?? ""}
      </TableCell>
      <TableCell className={cv("supplier", "text-sm text-muted-foreground hidden md:table-cell")}>
        {supplier?.name ?? ""}
      </TableCell>
      <TableCell className={cv("project", "text-sm text-muted-foreground")}>
        {project?.name ?? ""}
      </TableCell>
      <TableCell className={cv("km", "text-right text-sm hidden md:table-cell")}>
        {expense.km_distance || "--"}
      </TableCell>
      <TableCell
        className={cv(
          "total",
          `text-right text-sm font-medium ${
            expense.expense_type === "credito_ricevuto"
              ? "text-green-600 dark:text-green-400"
              : ""
          }`,
        )}
      >
        {eur(total)}
      </TableCell>
      <TableCell className={cv("description", "text-sm text-muted-foreground hidden lg:table-cell")}>
        {expense.description ?? ""}
      </TableCell>
    </TableRow>
  );
};
