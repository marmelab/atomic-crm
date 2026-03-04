import { useShowContext, useGetList, useUpdate, useDelete } from "ra-core";
import { Link, useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Edit, Trash2, Power, PowerOff } from "lucide-react";
import { ShowBase } from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Workflow, WorkflowExecution } from "../types";
import {
  triggerResourceLabels,
  triggerEventLabels,
  actionTypeLabels,
  describeWorkflow,
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
    <div className="mt-4 px-4 md:px-0 max-w-2xl">
      {isMobile && (
        <div className="mb-3">
          <MobileBackButton />
        </div>
      )}
      <WorkflowDetailCard record={record} />
      <WorkflowExecutionHistory executions={executions} />
    </div>
  );
};

const WorkflowDetailCard = ({ record }: { record: Workflow }) => {
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
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">{record.name}</CardTitle>
            {record.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {record.description}
              </p>
            )}
          </div>
          <Badge variant={record.is_active ? "default" : "secondary"}>
            {record.is_active ? "Attivo" : "Disattivato"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          {describeWorkflow(
            record.trigger_resource,
            record.trigger_event,
            record.trigger_conditions,
            record.actions,
          )}
        </div>

        <Separator />

        <WorkflowTriggerDetails record={record} />
        <WorkflowActionsList actions={record.actions} />

        <Separator />

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
      </CardContent>
    </Card>
  );
};

const WorkflowTriggerDetails = ({ record }: { record: Workflow }) => (
  <>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
      <div>
        <span className="text-muted-foreground">Risorsa trigger</span>
        <p className="font-medium">
          {triggerResourceLabels[record.trigger_resource]}
        </p>
      </div>
      <div>
        <span className="text-muted-foreground">Evento trigger</span>
        <p className="font-medium">
          {triggerEventLabels[record.trigger_event]}
        </p>
      </div>
    </div>
    {record.trigger_conditions &&
      Object.keys(record.trigger_conditions).length > 0 && (
        <div className="text-sm">
          <span className="text-muted-foreground">Condizioni</span>
          <pre className="mt-1 rounded bg-muted p-2 text-xs overflow-x-auto">
            {JSON.stringify(record.trigger_conditions, null, 2)}
          </pre>
        </div>
      )}
  </>
);

const WorkflowActionsList = ({
  actions,
}: {
  actions: Workflow["actions"];
}) => (
  <div className="text-sm">
    <span className="text-muted-foreground">
      Azioni ({actions?.length ?? 0})
    </span>
    <div className="mt-1 space-y-1">
      {actions?.map((action, i) => (
        <div key={i} className="rounded bg-muted p-2 text-xs">
          <span className="font-medium">
            {actionTypeLabels[action.type] ?? action.type}
          </span>
          {action.data && Object.keys(action.data).length > 0 && (
            <pre className="mt-1 overflow-x-auto">
              {JSON.stringify(action.data, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  </div>
);

const WorkflowExecutionHistory = ({
  executions,
}: {
  executions?: WorkflowExecution[];
}) => {
  if (!executions?.length) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm">Ultime esecuzioni</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {executions.map((exec) => (
            <div
              key={exec.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded bg-muted/50 p-2 text-xs"
            >
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    exec.execution_status === "completed"
                      ? "default"
                      : "destructive"
                  }
                  className="text-xs"
                >
                  {exec.execution_status}
                </Badge>
                <span className="text-muted-foreground">
                  {exec.trigger_resource} #{exec.trigger_record_id}
                </span>
              </div>
              <span className="text-muted-foreground">
                {new Date(exec.executed_at).toLocaleString("it-IT")}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
