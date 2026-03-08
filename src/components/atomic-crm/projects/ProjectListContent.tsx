import { useListContext, useCreatePath, useGetOne } from "ra-core";
import { Link } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ResizableHead,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { useResizableColumns } from "@/hooks/useResizableColumns";
import type { LucideIcon } from "lucide-react";
import {
  Tv,
  Sparkles,
  Heart,
  PartyPopper,
  Globe,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { Project } from "../types";
import { PROJECT_COLUMNS } from "../misc/columnDefinitions";
import {
  projectCategoryLabels,
  projectStatusLabels,
  projectTvShowLabels,
} from "./projectTypes";
import { formatDateRange } from "../misc/formatDateRange";
import {
  ListSelectAllCheckbox,
  ListRowCheckbox,
  MobileSelectableCard,
  ListBulkToolbar,
} from "../misc/ListBulkSelection";

export const ProjectListContent = () => {
  const { data, isPending } = useListContext<Project>();
  const createPath = useCreatePath();
  const isMobile = useIsMobile();
  const { cv } = useColumnVisibility("projects", PROJECT_COLUMNS);
  const { getWidth, onResizeStart, headerRef } = useResizableColumns("projects");

  if (isPending || !data) return null;

  if (isMobile) {
    return (
      <>
        <div className="flex flex-col divide-y px-2">
          {data.map((project) => (
            <MobileSelectableCard key={project.id} id={project.id}>
              <ProjectMobileCard
                project={project}
                link={createPath({
                  resource: "projects",
                  type: "show",
                  id: project.id,
                })}
              />
            </MobileSelectableCard>
          ))}
        </div>
        <ListBulkToolbar />
      </>
    );
  }

  return (
    <>
      <Table style={{ tableLayout: "fixed" }}>
        <TableHeader ref={headerRef}>
          <TableRow>
            <TableHead className="w-10">
              <ListSelectAllCheckbox />
            </TableHead>
            <ResizableHead colKey="name" width={getWidth("name")} onResizeStart={onResizeStart} className={cv("name")}>Nome progetto</ResizableHead>
            <ResizableHead colKey="client" width={getWidth("client")} onResizeStart={onResizeStart} className={cv("client")}>Cliente</ResizableHead>
            <ResizableHead colKey="category" width={getWidth("category")} onResizeStart={onResizeStart} className={cv("category")}>Categoria</ResizableHead>
            <ResizableHead colKey="status" width={getWidth("status")} onResizeStart={onResizeStart} className={cv("status", "hidden md:table-cell")}>Stato</ResizableHead>
            <ResizableHead colKey="period" width={getWidth("period")} onResizeStart={onResizeStart} className={cv("period", "hidden lg:table-cell")}>Periodo</ResizableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              link={createPath({
                resource: "projects",
                type: "show",
                id: project.id,
              })}
            />
          ))}
        </TableBody>
      </Table>
      <ListBulkToolbar />
    </>
  );
};

/* ---- Mobile card ---- */
const ProjectMobileCard = ({
  project,
  link,
}: {
  project: Project;
  link: string;
}) => {
  const { data: client } = useGetOne("clients", { id: project.client_id });

  return (
    <Link
      to={link}
      className="flex flex-col gap-1 px-1 py-3 active:bg-muted/50"
    >
      <span className="text-base font-bold">{project.name}</span>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {client?.name ?? ""}
        </span>
        <ProjectStatusBadge status={project.status} />
      </div>
      <div className="flex items-center gap-2">
        <ProjectCategoryBadge category={project.category} />
        {project.tv_show && (
          <span className="text-xs text-muted-foreground">
            {projectTvShowLabels[project.tv_show]}
          </span>
        )}
      </div>
    </Link>
  );
};

/* ---- Desktop table row ---- */
const ProjectRow = ({ project, link }: { project: Project; link: string }) => {
  const { cv } = useColumnVisibility("projects", PROJECT_COLUMNS);
  const { data: client } = useGetOne("clients", { id: project.client_id });

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50">
      <TableCell className="w-10">
        <ListRowCheckbox id={project.id} />
      </TableCell>
      <TableCell className={cv("name")}>
        <div className="flex items-start gap-3">
          <ProjectIconAvatar category={project.category} />
          <div className="min-w-0">
            <Link
              to={link}
              className="font-medium text-primary hover:underline block"
            >
              {project.name}
            </Link>
            {project.tv_show && (
              <span className="text-xs text-muted-foreground">
                {projectTvShowLabels[project.tv_show]}
              </span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className={cv("client", "text-muted-foreground")}>
        {client?.name ?? ""}
      </TableCell>
      <TableCell className={cv("category")}>
        <ProjectCategoryBadge category={project.category} />
      </TableCell>
      <TableCell className={cv("status", "hidden md:table-cell")}>
        <ProjectStatusBadge status={project.status} />
      </TableCell>
      <TableCell className={cv("period", "hidden lg:table-cell text-muted-foreground text-sm")}>
        {formatDateRange(project.start_date, project.end_date, project.all_day)}
      </TableCell>
    </TableRow>
  );
};

const categoryConfig: Record<
  string,
  { icon: LucideIcon; color: string; bg: string }
> = {
  produzione_tv: {
    icon: Tv,
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200",
  },
  spot: {
    icon: Sparkles,
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
  },
  wedding: {
    icon: Heart,
    color: "text-rose-600",
    bg: "bg-rose-50 border-rose-200",
  },
  evento_privato: {
    icon: PartyPopper,
    color: "text-orange-600",
    bg: "bg-orange-50 border-orange-200",
  },
  sviluppo_web: {
    icon: Globe,
    color: "text-violet-600",
    bg: "bg-violet-50 border-violet-200",
  },
};

const ProjectIconAvatar = ({ category }: { category: string }) => {
  const config = categoryConfig[category];
  const Icon = config?.icon ?? FolderOpen;
  const colorClass = config?.color ?? "text-slate-500";
  const bgClass = config?.bg ?? "bg-slate-50 border-slate-200";

  return (
    <div
      className={cn(
        "flex-shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center",
        bgClass,
      )}
    >
      <Icon className={cn("h-5 w-5", colorClass)} />
    </div>
  );
};

export const ProjectCategoryBadge = ({ category }: { category: string }) => {
  const config = categoryConfig[category];
  if (!config) {
    return (
      <Badge variant="outline">
        {projectCategoryLabels[category] ?? category}
      </Badge>
    );
  }
  const Icon = config.icon;
  return (
    <Badge
      variant="outline"
      className={cn("inline-flex items-center gap-1.5", config.bg)}
    >
      <Icon className={cn("h-3 w-3", config.color)} />
      <span className={config.color}>
        {projectCategoryLabels[category] ?? category}
      </span>
    </Badge>
  );
};

const statusConfig: Record<string, { color: string; bg: string }> = {
  in_corso: { color: "text-green-700", bg: "bg-green-50 border-green-200" },
  completato: { color: "text-slate-700", bg: "bg-slate-100 border-slate-300" },
  in_pausa: { color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  cancellato: { color: "text-red-700", bg: "bg-red-50 border-red-200" },
};

export const ProjectStatusBadge = ({ status }: { status: string }) => {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn(config?.bg, config?.color)}>
      {projectStatusLabels[status] ?? status}
    </Badge>
  );
};
