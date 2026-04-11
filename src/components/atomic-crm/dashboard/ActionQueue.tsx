import { Zap } from "lucide-react";
import { useGetIdentity, useGetList, useRedirect } from "ra-core";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import type { Deal, Task } from "../types";
import { getDealDecayLevel } from "../deals/dealUtils";

type ActionItem = {
  id: string;
  kind: "overdue-task" | "stale-deal";
  label: string;
  detail: string;
  urgency: "amber" | "red";
  days: number;
  onClick: () => void;
};

const TERMINAL_STAGES = ["won", "lost"];

export const ActionQueue = () => {
  const { identity } = useGetIdentity();
  const redirect = useRedirect();

  const { data: deals } = useGetList<Deal>("deals", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "updated_at", order: "ASC" },
    filter: { "archived_at@is": null },
  });

  const { data: tasks } = useGetList<Task>("tasks", {
    pagination: { page: 1, perPage: 50 },
    sort: { field: "due_date", order: "ASC" },
    filter: { "done_date@is": null, sales_id: identity?.id },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const actions: ActionItem[] = [];

  // Overdue tasks
  (tasks ?? []).forEach((task) => {
    const due = new Date(task.due_date);
    due.setHours(0, 0, 0, 0);
    if (due >= today) return;
    const daysOverdue = Math.floor(
      (today.getTime() - due.getTime()) / 86400000,
    );
    actions.push({
      id: `task-${task.id}`,
      kind: "overdue-task",
      label: task.text,
      detail: `${daysOverdue}d overdue`,
      urgency: daysOverdue >= 3 ? "red" : "amber",
      days: daysOverdue,
      onClick: () =>
        redirect(`/contacts/${task.contact_id}/show`, undefined, undefined, undefined, {
          _scrollToTop: false,
        }),
    });
  });

  // Stale deals (red first, then amber)
  (deals ?? [])
    .filter((d) => !TERMINAL_STAGES.includes(d.stage))
    .forEach((deal) => {
      const decay = getDealDecayLevel(deal);
      if (decay === "none") return;
      const days = Math.floor(
        (Date.now() - new Date(deal.updated_at).getTime()) / 86400000,
      );
      actions.push({
        id: `deal-${deal.id}`,
        kind: "stale-deal",
        label: deal.name,
        detail: `${days}d no activity`,
        urgency: decay === "red" ? "red" : "amber",
        days,
        onClick: () =>
          redirect(`/deals/${deal.id}/show`, undefined, undefined, undefined, {
            _scrollToTop: false,
          }),
      });
    });

  // Sort: red before amber, then by most days first within each group
  actions.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === "red" ? -1 : 1;
    return b.days - a.days;
  });

  const topActions = actions.slice(0, 8);

  if (topActions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center">
        <div className="mr-3 flex">
          <Zap className="text-primary w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-muted-foreground">
          Action Queue
        </h2>
        <Badge variant="secondary" className="ml-2">
          {actions.length}
        </Badge>
      </div>
      <Card className="p-0 overflow-hidden">
        <ul className="divide-y">
          {topActions.map((action) => (
            <li
              key={action.id}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
              onClick={action.onClick}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  action.urgency === "red" ? "bg-red-500" : "bg-amber-400"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{action.label}</p>
                <p className="text-xs text-muted-foreground">
                  {action.kind === "overdue-task" ? "Task" : "Deal"} &middot;{" "}
                  {action.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};
