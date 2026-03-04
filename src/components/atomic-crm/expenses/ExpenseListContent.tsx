import { useListContext, useCreatePath, useGetOne } from "ra-core";
import { Link } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";

import type { Expense } from "../types";
import { expenseTypeLabels } from "./expenseTypes";
import { ErrorMessage } from "../misc/ErrorMessage";
import { calculateKmReimbursement } from "@/lib/semantics/crmSemanticRegistry";
import { useConfigurationContext } from "../root/ConfigurationContext";

const eur = (n: number) =>
  n ? n.toLocaleString("it-IT", { minimumFractionDigits: 2 }) : "--";

const computeTotal = (e: Expense, defaultKmRate: number) => {
  if (e.expense_type === "credito_ricevuto") {
    return -(e.amount ?? 0);
  }
  if (e.expense_type === "spostamento_km") {
    return calculateKmReimbursement({
      kmDistance: e.km_distance,
      kmRate: e.km_rate,
      defaultKmRate,
    });
  }
  return (e.amount ?? 0) * (1 + (e.markup_percent ?? 0) / 100);
};

export const ExpenseListContent = () => {
  const { data, isPending, error } = useListContext<Expense>();
  const { operationalConfig } = useConfigurationContext();
  const createPath = useCreatePath();
  const isMobile = useIsMobile();

  if (error) return <ErrorMessage />;
  if (isPending || !data) return null;

  if (isMobile) {
    return (
      <div className="flex flex-col divide-y px-4">
        {data.map((expense) => (
          <ExpenseMobileCard
            key={expense.id}
            expense={expense}
            defaultKmRate={operationalConfig.defaultKmRate}
            link={createPath({
              resource: "expenses",
              type: "show",
              id: expense.id,
            })}
          />
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Data</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead className="hidden md:table-cell">Cliente</TableHead>
          <TableHead>Progetto</TableHead>
          <TableHead className="text-right hidden md:table-cell">Km</TableHead>
          <TableHead className="text-right">Totale EUR</TableHead>
          <TableHead className="hidden lg:table-cell">Descrizione</TableHead>
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
  );
};

/* ---- Mobile card ---- */
const ExpenseMobileCard = ({
  expense,
  link,
  defaultKmRate,
}: {
  expense: Expense;
  link: string;
  defaultKmRate: number;
}) => {
  const { data: project } = useGetOne(
    "projects",
    { id: expense.project_id ?? undefined },
    { enabled: !!expense.project_id },
  );
  const total = computeTotal(expense, defaultKmRate);

  return (
    <Link
      to={link}
      className="flex flex-col gap-1 px-1 py-3 active:bg-muted/50"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {new Date(expense.expense_date).toLocaleDateString("it-IT")}
        </span>
        <span className="text-xs text-muted-foreground">
          {expense.expense_type === "credito_ricevuto" ? (
            <Badge variant="secondary" className="text-green-700">
              Credito
            </Badge>
          ) : (
            (expenseTypeLabels[expense.expense_type] ?? expense.expense_type)
          )}
        </span>
      </div>
      <span className="text-sm font-medium">{project?.name ?? ""}</span>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground truncate mr-2">
          {expense.description ?? ""}
        </span>
        <span
          className={`text-sm font-semibold tabular-nums ${
            expense.expense_type === "credito_ricevuto"
              ? "text-green-600 dark:text-green-400"
              : ""
          }`}
        >
          EUR {eur(total)}
        </span>
      </div>
    </Link>
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
  const total = computeTotal(expense, defaultKmRate);

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50">
      <TableCell className="text-sm">
        <Link to={link} className="text-primary hover:underline">
          {new Date(expense.expense_date).toLocaleDateString("it-IT")}
        </Link>
      </TableCell>
      <TableCell className="text-sm">
        {expense.expense_type === "credito_ricevuto" ? (
          <Badge variant="secondary" className="text-green-700">
            Credito
          </Badge>
        ) : (
          (expenseTypeLabels[expense.expense_type] ?? expense.expense_type)
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
        {client?.name ?? ""}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {project?.name ?? ""}
      </TableCell>
      <TableCell className="text-right text-sm hidden md:table-cell">
        {expense.km_distance || "--"}
      </TableCell>
      <TableCell
        className={`text-right text-sm font-medium ${
          expense.expense_type === "credito_ricevuto"
            ? "text-green-600 dark:text-green-400"
            : ""
        }`}
      >
        {eur(total)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
        {expense.description ?? ""}
      </TableCell>
    </TableRow>
  );
};
