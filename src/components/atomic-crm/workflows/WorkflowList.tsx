import { useState } from "react";
import { useListContext, useCreatePath, useUpdate } from "ra-core";
import { Link } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { List } from "@/components/admin/list";
import { CreateButton } from "@/components/admin/create-button";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

import { MobilePageTitle } from "../layout/MobilePageTitle";
import { TopToolbar } from "../layout/TopToolbar";
import type { Workflow } from "../types";
import {
  triggerResourceLabels,
  triggerEventLabels,
  triggerResourceIcons,
  triggerResourceColors,
  actionTypeLabels,
  actionTypeIcons,
  describeConditions,
} from "./workflowTypes";

export const WorkflowList = () => (
  <List
    title={false}
    actions={<WorkflowListActions />}
    perPage={25}
    sort={{ field: "created_at", order: "DESC" }}
  >
    <WorkflowListLayout />
  </List>
);

const WorkflowListActions = () => (
  <TopToolbar className="px-4 md:px-0">
    <CreateButton />
  </TopToolbar>
);

const WorkflowListLayout = () => {
  const { data, isPending } = useListContext<Workflow>();
  const isMobile = useIsMobile();

  if (isPending || !data) return null;

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-6">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Zap className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-base font-medium mb-1">Nessuna automazione</p>
        <p className="text-sm text-muted-foreground mb-6">
          Le automazioni eseguono azioni quando accadono eventi nel CRM.
        </p>
        <CreateButton />
      </div>
    );
  }

  return (
    <>
      {isMobile ? (
        <MobileWorkflowList data={data} />
      ) : (
        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Azioni</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((workflow) => (
                <WorkflowRow key={workflow.id} workflow={workflow} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
};

// ─── Mobile ─────────────────────────────────────────────────────────────────

const MobileWorkflowList = ({ data }: { data: Workflow[] }) => (
  <div className="flex flex-col gap-3 px-4 pb-4">
    <MobilePageTitle title="Automazioni" />
    <p className="text-sm text-muted-foreground">
      Azioni automatiche al verificarsi di eventi nel CRM.
    </p>
    {data.map((workflow) => (
      <WorkflowMobileCard key={workflow.id} workflow={workflow} />
    ))}
  </div>
);

const WorkflowMobileCard = ({ workflow }: { workflow: Workflow }) => {
  const createPath = useCreatePath();
  const link = createPath({
    resource: "workflows",
    type: "show",
    id: workflow.id,
  });

  const TriggerIcon = triggerResourceIcons[workflow.trigger_resource] ?? Zap;
  const triggerColor = triggerResourceColors[workflow.trigger_resource] ?? "";
  const firstAction = workflow.actions?.[0];
  const ActionIcon = firstAction
    ? (actionTypeIcons[firstAction.type] ?? Zap)
    : Zap;
  const conditionStr = describeConditions(
    workflow.trigger_resource,
    workflow.trigger_conditions,
  );

  return (
    <Link
      to={link}
      className={cn(
        "block rounded-xl border bg-card shadow-sm transition-colors",
        !workflow.is_active && "opacity-60",
      )}
    >
      {/* Header: Name + Toggle */}
      <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-1">
        <p className="font-semibold text-sm leading-snug">{workflow.name}</p>
        {/* Stop click from navigating when toggling */}
        <div
          onClick={(e) => e.preventDefault()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <WorkflowToggle workflow={workflow} />
        </div>
      </div>

      {/* Visual flow: vertical Trigger → Action */}
      <div className="px-4 pb-3.5 space-y-2">
        {/* Trigger row */}
        <div className="flex items-center gap-2.5">
          <div className={cn("shrink-0 rounded-lg p-1.5", triggerColor)}>
            <TriggerIcon className="h-4 w-4" />
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {triggerResourceLabels[workflow.trigger_resource]}
            </span>{" "}
            {triggerEventLabels[workflow.trigger_event]?.toLowerCase()}
            {conditionStr ? ` ${conditionStr}` : ""}
          </p>
        </div>

        {/* Arrow */}
        <div className="pl-3">
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 rotate-90" />
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2.5">
          <div className="shrink-0 rounded-lg p-1.5 bg-muted">
            <ActionIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {firstAction
                ? (actionTypeLabels[firstAction.type] ?? firstAction.type)
                : "Nessuna azione"}
            </span>
            {firstAction?.type === "create_task" && firstAction.data?.text && (
              <>
                {" — "}
                {String(firstAction.data.text)}
              </>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
};

const WorkflowToggle = ({ workflow }: { workflow: Workflow }) => {
  const [update] = useUpdate();
  const [optimistic, setOptimistic] = useState(workflow.is_active);

  const handleToggle = (checked: boolean) => {
    setOptimistic(checked);
    update(
      "workflows",
      {
        id: workflow.id,
        data: { is_active: checked },
        previousData: workflow,
      },
      {
        onError: () => setOptimistic(!checked),
      },
    );
  };

  return (
    <Switch
      checked={optimistic}
      onCheckedChange={handleToggle}
      aria-label={`${workflow.is_active ? "Disattiva" : "Attiva"} ${workflow.name}`}
      onClick={(e) => e.stopPropagation()}
    />
  );
};

// ─── Desktop ────────────────────────────────────────────────────────────────

const WorkflowRow = ({ workflow }: { workflow: Workflow }) => (
  <TableRow className="cursor-pointer hover:bg-muted/50">
    <TableCell>
      <Link
        to={`/workflows/${workflow.id}/show`}
        className="font-medium text-primary hover:underline block"
      >
        {workflow.name}
      </Link>
      {workflow.description && (
        <span className="text-xs text-muted-foreground">
          {workflow.description}
        </span>
      )}
    </TableCell>
    <TableCell>
      <div className="flex flex-col gap-1">
        <Badge variant="outline" className="w-fit">
          {triggerResourceLabels[workflow.trigger_resource]}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {triggerEventLabels[workflow.trigger_event]}
        </span>
      </div>
    </TableCell>
    <TableCell>
      <span className="text-sm">{workflow.actions?.length || 0} azioni</span>
    </TableCell>
    <TableCell>
      <Badge variant={workflow.is_active ? "default" : "secondary"}>
        {workflow.is_active ? "Attivo" : "Disattivato"}
      </Badge>
    </TableCell>
  </TableRow>
);
