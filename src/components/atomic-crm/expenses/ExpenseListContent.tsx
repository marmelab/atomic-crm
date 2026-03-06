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
import type { LucideIcon } from "lucide-react";
import {
  Car,
  ShoppingCart,
  ArrowLeftRight,
  Receipt,
  Utensils,
  Highway,
  MonitorSmartphone,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { Expense } from "../types";
import { expenseTypeLabels } from "./expenseTypes";
import { ErrorMessage } from "../misc/ErrorMessage";
import { calculateKmReimbursement } from "@/lib/semantics/crmSemanticRegistry";
import { useConfigurationContext } from "../root/ConfigurationContext";

const eur = (n: number) =>
  n ? n.toLocaleString("it-IT", { minimumFractionDigits: 2 }) : "--";

const expenseTypeIcons: Record<string, LucideIcon> = {
  spostamento_km: Car,
  pedaggio_autostradale: Highway,
  vitto_alloggio: Utensils,
  acquisto_materiale: ShoppingCart,
  abbonamento_software: MonitorSmartphone,
  noleggio: Package,
  credito_ricevuto: ArrowLeftRight,
  altro: Receipt,
};

const expenseTypeColors: Record<string, string> = {
  spostamento_km: "text-amber-600 bg-amber-50 border-amber-200",
  pedaggio_autostradale: "text-orange-600 bg-orange-50 border-orange-200",
  vitto_alloggio: "text-rose-600 bg-rose-50 border-rose-200",
  acquisto_materiale: "text-blue-600 bg-blue-50 border-blue-200",
  abbonamento_software: "text-violet-600 bg-violet-50 border-violet-200",
  noleggio: "text-cyan-600 bg-cyan-50 border-cyan-200",
  credito_ricevuto: "text-green-600 bg-green-50 border-green-200",
  altro: "text-slate-600 bg-slate-50 border-slate-200",
};

const ExpenseIconAvatar = ({ type }: { type: string }) => {
  const Icon = expenseTypeIcons[type] ?? Receipt;
  const colorClass = expenseTypeColors[type]?.split(" ")[0] ?? "text-slate-600";
  const bgClass =
    expenseTypeColors[type]?.split(" ").slice(1).join(" ") ??
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
      <div className="flex items-center gap-3">
        <ExpenseIconAvatar type={expense.expense_type} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium truncate">
              {expenseTypeLabels[expense.expense_type] ?? expense.expense_type}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(expense.expense_date).toLocaleDateString("it-IT")}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{project?.name ?? ""}</span>
        </div>
      </div>
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
