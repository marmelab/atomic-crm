import { useListContext } from "ra-core";
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
import { List } from "@/components/admin/list";
import { CreateButton } from "@/components/admin/create-button";
import { MobilePageTitle } from "../layout/MobilePageTitle";
import { TopToolbar } from "../layout/TopToolbar";
import type { Workflow } from "../types";
import { triggerResourceLabels, triggerEventLabels } from "./workflowTypes";

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
  <TopToolbar>
    <CreateButton />
  </TopToolbar>
);

const WorkflowListLayout = () => {
  const { data, isPending } = useListContext<Workflow>();

  if (isPending || !data) return null;

  if (!data.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-muted-foreground mb-4">Nessun workflow configurato</p>
        <CreateButton />
      </div>
    );
  }

  return (
    <>
      <MobilePageTitle title="Automazioni" />
      <div className="mt-4">
        <p className="text-sm text-muted-foreground mb-4">
          Automazioni che si attivano quando accadono cose nel CRM.
        </p>
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
    </>
  );
};

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
        <span className="text-xs text-muted-foreground">{workflow.description}</span>
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
