import { AlertCircle, DollarSign, Percent, Trophy } from "lucide-react";
import { useGetIdentity, useGetList } from "ra-core";
import { Link } from "react-router";
import { Card } from "@/components/ui/card";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal, Task } from "../types";

const today = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatCurrency = (value: number, currency: string) =>
  value.toLocaleString(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

export const KPICards = () => {
  const { currency } = useConfigurationContext();
  const { identity, isPending: identityPending } = useGetIdentity();

  const { data: deals, isPending: dealsPending } = useGetList<Deal>("deals", {
    pagination: { page: 1, perPage: 10000 },
  });

  const { data: tasks, isPending: tasksPending } = useGetList<Task>(
    "tasks",
    {
      pagination: { page: 1, perPage: 10000 },
      sort: { field: "due_date", order: "ASC" },
      filter: { sales_id: identity?.id },
    },
    { enabled: !!identity },
  );

  if (identityPending || dealsPending || tasksPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-24 rounded-xl bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  const pipelineValue =
    deals
      ?.filter((deal) => !["won", "lost"].includes(deal.stage))
      .reduce((sum, deal) => sum + (deal.amount ?? 0), 0) ?? 0;

  const wonDeals = deals?.filter((deal) => deal.stage === "won") ?? [];
  const dealsWon = wonDeals.length;
  const closedDeals = deals?.filter((deal) => ["won", "lost"].includes(deal.stage)).length ?? 0;
  const startOfToday = today();

  const overdueTasks =
    tasks?.filter((task) => {
      if (!task.due_date || task.done_date) {
        return false;
      }

      return new Date(task.due_date) < startOfToday;
    }).length ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Link to="/deals" className="transition-opacity hover:opacity-80">
        <Card className="gap-3 p-4 cursor-pointer">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Pipeline Value
            </p>
            <p className="text-2xl font-bold">
              {formatCurrency(pipelineValue, currency)}
            </p>
          </div>
        </Card>
      </Link>
      <Link
        to={`/deals?filter=${encodeURIComponent(JSON.stringify({ stage: "won" }))}`}
        className="transition-opacity hover:opacity-80"
      >
        <Card className="gap-3 p-4 cursor-pointer">
          <Trophy className="h-5 w-5 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Deals Won
            </p>
            <p className="text-2xl font-bold">{dealsWon}</p>
          </div>
        </Card>
      </Link>
      <Link
        to="/deals"
        className="transition-opacity hover:opacity-80"
      >
        <Card className="gap-3 p-4 cursor-pointer">
          <Percent className="h-5 w-5 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Win Rate</p>
            <p className="text-2xl font-bold">
              {closedDeals > 0
                ? `${Math.round((dealsWon / closedDeals) * 100)}%`
                : "—"}
            </p>
          </div>
        </Card>
      </Link>
      <Link to="/tasks" className="transition-opacity hover:opacity-80">
        <Card className="gap-3 p-4 cursor-pointer">
          <AlertCircle className="h-5 w-5 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Overdue Tasks
            </p>
            <p
              className={`text-2xl font-bold ${
                overdueTasks > 0 ? "text-destructive" : ""
              }`}
            >
              {overdueTasks}
            </p>
          </div>
        </Card>
      </Link>
    </div>
  );
};
