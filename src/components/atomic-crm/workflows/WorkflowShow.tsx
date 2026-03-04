import { useShowContext, useGetList, useUpdate, useDelete } from "ra-core";
import { Link, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Edit,
  Trash2,
  Power,
  PowerOff,
  Zap,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { ShowBase } from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import type { Workflow, WorkflowExecution } from "../types";
import {
  triggerResourceLabels,
  triggerEventLabels,
  triggerResourceIcons,
  triggerResourceColors,
  actionTypeIcons,
  describeWorkflow,
  describeConditions,
  describeAction,
} from "./workflowTypes";
import { MobileBackButton } from "../misc/MobileBackButton";

export const WorkflowShow = () => (
  <ShowBase>
    <WorkflowShowContent />
  </ShowBase>
);

const WorkflowShowContent = () => {
  const { record, isPending } = useShowContext<Workflow>();
  const isMobile = useIsMobile();

  const { data: executions } = useGetList<WorkflowExecution>(
    "workflow_executions",
    {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "executed_at", order: "DESC" },
      filter: record ? { "workflow_id@eq": record.id } : {},
    },
    { enabled: !!record },
  );

  if (isPending || !record) return null;

  return (
    <div className="mt-4 px-4 md:px-0 max-w-2xl space-y-4">
      {isMobile && (
        <div>
          <MobileBackButton />
        </div>
      )}

      {/* Header card */}
      <WorkflowHeader record={record} />

      {/* Visual flow card */}
      <WorkflowFlowCard record={record} />

      {/* Actions */}
      <WorkflowActions record={record} />

      {/* Execution history */}
      <WorkflowExecutionHistory executions={executions} />
    </div>
  );
};

// ─── Header ──────────────────────────────────────────────────────────────────

const WorkflowHeader = ({ record }: { record: Workflow }) => {
  const [update] = useUpdate();
  const isMobile = useIsMobile();

  const handleToggle = (checked: boolean) => {
    update("workflows", {
      id: record.id,
      data: { is_active: checked },
      previousData: record,
    });
  };

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold leading-tight">
              {record.name}
            </h1>
            {record.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {record.description}
              </p>
            )}
          </div>
          {isMobile ? (
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              <span className="text-xs text-muted-foreground">
                {record.is_active ? "Attivo" : "Off"}
              </span>
              <Switch
                checked={record.is_active}
                onCheckedChange={handleToggle}
                aria-label="Attiva/Disattiva"
              />
            </div>
          ) : (
            <Badge
              variant={record.is_active ? "default" : "secondary"}
              className="shrink-0"
            >
              {record.is_active ? "Attivo" : "Disattivato"}
            </Badge>
          )}
        </div>

        {/* Natural language summary */}
        <div className="mt-3 rounded-md bg-muted/50 p-3 text-sm flex items-start gap-2">
          <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>
            {describeWorkflow(
              record.trigger_resource,
              record.trigger_event,
              record.trigger_conditions,
              record.actions,
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Visual flow ─────────────────────────────────────────────────────────────

const WorkflowFlowCard = ({ record }: { record: Workflow }) => {
  const TriggerIcon = triggerResourceIcons[record.trigger_resource] ?? Zap;
  const triggerColor = triggerResourceColors[record.trigger_resource] ?? "";
  const conditionText = describeConditions(
    record.trigger_resource,
    record.trigger_conditions,
  );

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        {/* TRIGGER section */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Quando succede
          </p>
          <div className="rounded-xl border bg-background p-3">
            <div className="flex items-center gap-3">
              <div className={cn("shrink-0 rounded-lg p-2", triggerColor)}>
                <TriggerIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {triggerResourceLabels[record.trigger_resource]}
                </p>
                <p className="text-xs text-muted-foreground">
                  {triggerEventLabels[record.trigger_event]}
                  {conditionText ? ` ${conditionText}` : ""}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Arrow connector */}
        <div className="flex justify-center">
          <ArrowRight className="h-5 w-5 text-muted-foreground/40 rotate-90" />
        </div>

        {/* ACTION section */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Allora fai
          </p>
          <div className="space-y-2">
            {record.actions?.map((action, i) => {
              const ActionIcon = actionTypeIcons[action.type] ?? Zap;
              return (
                <div key={i} className="rounded-xl border bg-background p-3">
                  <div className="flex items-center gap-3">
                    <div className="shrink-0 rounded-lg p-2 bg-muted">
                      <ActionIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium min-w-0 flex-1">
                      {describeAction(action)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Action buttons ──────────────────────────────────────────────────────────

const WorkflowActions = ({ record }: { record: Workflow }) => {
  const [update] = useUpdate();
  const [deleteOne] = useDelete();
  const navigate = useNavigate();

  const toggleActive = () => {
    update("workflows", {
      id: record.id,
      data: { is_active: !record.is_active },
      previousData: record,
    });
  };

  const handleDelete = () => {
    if (!confirm("Eliminare questo workflow?")) return;
    deleteOne("workflows", { id: record.id, previousData: record });
    navigate("/workflows");
  };

  return (
    <div className="flex gap-2 flex-wrap">
      <Button variant="outline" size="sm" onClick={toggleActive}>
        {record.is_active ? (
          <>
            <PowerOff className="h-4 w-4 mr-1" /> Disattiva
          </>
        ) : (
          <>
            <Power className="h-4 w-4 mr-1" /> Attiva
          </>
        )}
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link to={`/workflows/${record.id}`}>
          <Edit className="h-4 w-4 mr-1" /> Modifica
        </Link>
      </Button>
      <Button variant="destructive" size="sm" onClick={handleDelete}>
        <Trash2 className="h-4 w-4 mr-1" /> Elimina
      </Button>
    </div>
  );
};

// ─── Execution history ───────────────────────────────────────────────────────

const WorkflowExecutionHistory = ({
  executions,
}: {
  executions?: WorkflowExecution[];
}) => {
  if (!executions?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Ultime esecuzioni
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {executions.map((exec) => (
            <ExecutionRow key={exec.id} exec={exec} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const ExecutionRow = ({ exec }: { exec: WorkflowExecution }) => {
  const isOk = exec.execution_status === "completed";

  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3 text-sm">
      {isOk ? (
        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">
          {triggerResourceLabels[exec.trigger_resource] ??
            exec.trigger_resource}
        </p>
        <p className="text-xs text-muted-foreground">
          {new Date(exec.executed_at).toLocaleString("it-IT")}
        </p>
      </div>
      <Badge
        variant={isOk ? "default" : "destructive"}
        className="shrink-0 text-xs"
      >
        {isOk ? "OK" : "Errore"}
      </Badge>
    </div>
  );
};
