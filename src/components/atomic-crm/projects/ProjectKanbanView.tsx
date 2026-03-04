import { useListContext, useUpdate, useCreatePath } from "ra-core";
import { Link } from "react-router";
import { useState } from "react";
import { Briefcase, Calendar, MoreHorizontal, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Project } from "../types";
import { projectCategoryLabels } from "./projectTypes";
import { formatCurrency } from "../dashboard/dashboardFormatters";
import { formatDateRange } from "../misc/formatDateRange";

const columns: { id: Project["status"]; label: string; color: string }[] = [
  {
    id: "in_corso",
    label: "In Corso",
    color: "bg-green-50 dark:bg-green-950/30",
  },
  {
    id: "in_pausa",
    label: "In Pausa",
    color: "bg-yellow-50 dark:bg-yellow-950/30",
  },
  {
    id: "completato",
    label: "Completati",
    color: "bg-gray-50 dark:bg-gray-950/30",
  },
  {
    id: "cancellato",
    label: "Cancellati",
    color: "bg-red-50 dark:bg-red-950/30",
  },
];

export const ProjectKanbanView = () => {
  const { data, isPending } = useListContext<Project>();
  const [update] = useUpdate();
  const [draggingId, setDraggingId] = useState<string | null>(null);

  if (isPending || !data) return null;

  const projectsByStatus = columns.reduce(
    (acc, col) => {
      acc[col.id] = data.filter((p) => p.status === col.id);
      return acc;
    },
    {} as Record<Project["status"], Project[]>,
  );

  const handleDragStart = (projectId: string) => {
    setDraggingId(projectId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  const handleDrop = (status: Project["status"]) => {
    if (!draggingId) return;

    const project = data.find((p) => p.id === draggingId);
    if (project && project.status !== status) {
      update("projects", {
        id: draggingId,
        data: { status },
        previousData: project,
      });
    }
    setDraggingId(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-150">
      {columns.map((column) => (
        <KanbanColumn
          key={column.id}
          column={column}
          projects={projectsByStatus[column.id] || []}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDrop={() => handleDrop(column.id)}
        />
      ))}
    </div>
  );
};

interface KanbanColumnProps {
  column: { id: Project["status"]; label: string; color: string };
  projects: Project[];
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: () => void;
}

const KanbanColumn = ({
  column,
  projects,
  onDragStart,
  onDragEnd,
  onDrop,
}: KanbanColumnProps) => {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      className={`shrink-0 w-80 ${column.color} rounded-lg p-3 transition-all ${
        isOver ? "ring-2 ring-primary ring-offset-2" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        onDrop();
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          {column.label}
          <Badge variant="secondary" className="text-xs">
            {projects.length}
          </Badge>
        </h3>
        <Link to={`/projects/create`}>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Plus className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="space-y-2">
        {projects.map((project) => (
          <KanbanCard
            key={project.id}
            project={project}
            onDragStart={() => onDragStart(project.id)}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
};

interface KanbanCardProps {
  project: Project;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const KanbanCard = ({ project, onDragStart, onDragEnd }: KanbanCardProps) => {
  const createPath = useCreatePath();
  const link = createPath({
    resource: "projects",
    type: "show",
    id: project.id,
  });

  return (
    <Card
      className="cursor-move hover:shadow-md transition-shadow bg-white dark:bg-gray-900"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={link}
            className="font-medium text-sm hover:underline line-clamp-2 flex-1"
          >
            {project.name}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -mr-2 -mt-2"
              >
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={link}>Visualizza</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`/projects/${project.id}`}>Modifica</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {projectCategoryLabels[project.category]}
          </Badge>
          {project.tv_show && (
            <span className="text-xs text-muted-foreground">📺</span>
          )}
        </div>

        {(project.start_date || project.budget) && (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {project.start_date && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDateRange(
                  project.start_date,
                  project.end_date,
                  project.all_day,
                )}
              </div>
            )}
            {project.budget && (
              <div className="flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                Budget: {formatCurrency(project.budget)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectKanbanView;
