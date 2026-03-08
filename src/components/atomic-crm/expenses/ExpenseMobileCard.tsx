import { useGetOne } from "ra-core";
import { Link } from "react-router";

import type { Expense } from "../types";
import { expenseTypeLabels } from "./expenseTypes";
import { ExpenseIconAvatar, computeTotal, eur } from "./expenseListHelpers";

export const ExpenseMobileCard = ({
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
            <span className="text-base font-bold truncate">
              {expenseTypeLabels[expense.expense_type] ?? expense.expense_type}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(expense.expense_date).toLocaleDateString("it-IT")}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {project?.name ?? ""}
          </span>
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
