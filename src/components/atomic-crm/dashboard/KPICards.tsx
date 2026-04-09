import { AlertCircle, DollarSign, TrendingUp, Trophy } from "lucide-react";
import { useGetIdentity, useGetList } from "ra-core";
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
  const totalWon = wonDeals.reduce((sum, deal) => sum + (deal.amount ?? 0), 0);
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
      <Card className="gap-3 p-4">
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
      <Card className="gap-3 p-4">
        <Trophy className="h-5 w-5 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            Deals Won
          </p>
          <p className="text-2xl font-bold">{dealsWon}</p>
        </div>
      </Card>
      <Card className="gap-3 p-4">
        <TrendingUp className="h-5 w-5 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Total Won</p>
          <p className="text-2xl font-bold">
            {formatCurrency(totalWon, currency)}
          </p>
        </div>
      </Card>
      <Card className="gap-3 p-4">
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
    </div>
  );
};
