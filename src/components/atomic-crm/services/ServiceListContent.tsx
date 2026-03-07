import { useListContext, useCreatePath, useGetOne } from "ra-core";
import { Link } from "react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LucideIcon } from "lucide-react";
import {
  Video,
  Scissors,
  Camera,
  Mic,
  FileText,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { Service } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { ErrorMessage } from "../misc/ErrorMessage";
import { formatDateRange } from "../misc/formatDateRange";
import { calculateServiceNetValue } from "@/lib/semantics/crmSemanticRegistry";
import {
  ListSelectAllCheckbox,
  ListRowCheckbox,
  MobileSelectableCard,
  ListBulkToolbar,
} from "../misc/ListBulkSelection";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { SERVICE_COLUMNS } from "../misc/columnDefinitions";

const eur = (n: number) =>
  n ? n.toLocaleString("it-IT", { minimumFractionDigits: 2 }) : "--";

const serviceTypeIcons: Record<string, LucideIcon> = {
  riprese: Video,
  montaggio: Scissors,
  fotografia: Camera,
  audio: Mic,
  documentazione: FileText,
  altro: Briefcase,
};

const serviceTypeColors: Record<string, string> = {
  riprese: "text-blue-600 bg-blue-50 border-blue-200",
  montaggio: "text-purple-600 bg-purple-50 border-purple-200",
  fotografia: "text-pink-600 bg-pink-50 border-pink-200",
  audio: "text-amber-600 bg-amber-50 border-amber-200",
  documentazione: "text-green-600 bg-green-50 border-green-200",
  altro: "text-slate-600 bg-slate-50 border-slate-200",
};

const ServiceIconAvatar = ({ type }: { type: string }) => {
  const Icon = serviceTypeIcons[type] ?? Briefcase;
  const colorClass = serviceTypeColors[type]?.split(" ")[0] ?? "text-slate-600";
  const bgClass =
    serviceTypeColors[type]?.split(" ").slice(1).join(" ") ??
    "bg-slate-50 border-slate-200";

  return (
    <div
      className={cn(
        "flex-shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center",
        bgClass,
      )}
    >
      <Icon className={cn("h-4 w-4", colorClass)} />
    </div>
  );
};

export const ServiceListContent = () => {
  const { data, isPending, error } = useListContext<Service>();
  const createPath = useCreatePath();
  const isMobile = useIsMobile();
  const { cv } = useColumnVisibility("services", SERVICE_COLUMNS);

  if (error) return <ErrorMessage />;
  if (isPending || !data) return null;

  if (isMobile) {
    return (
      <>
        <div className="flex flex-col divide-y px-2">
          {data.map((service) => (
            <MobileSelectableCard key={service.id} id={service.id}>
              <ServiceMobileCard
                service={service}
                link={createPath({
                  resource: "services",
                  type: "show",
                  id: service.id,
                })}
              />
            </MobileSelectableCard>
          ))}
        </div>
        <ListBulkToolbar allowDelete />
      </>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <ListSelectAllCheckbox />
            </TableHead>
            <TableHead className={cv("date", "w-24")}>Data</TableHead>
            <TableHead className={cv("project")}>Progetto</TableHead>
            <TableHead className={cv("type")}>Tipo</TableHead>
            <TableHead className={cv("description", "hidden lg:table-cell")}>Descrizione</TableHead>
            <TableHead className={cv("fee_shooting", "text-right hidden md:table-cell")}>
              Riprese
            </TableHead>
            <TableHead className={cv("fee_editing", "text-right hidden md:table-cell")}>
              Montaggio
            </TableHead>
            <TableHead className={cv("fee_other", "text-right hidden lg:table-cell")}>
              Altro
            </TableHead>
            <TableHead className={cv("total", "text-right")}>Totale</TableHead>
            <TableHead className={cv("km", "text-right hidden lg:table-cell")}>Km</TableHead>
            <TableHead className={cv("taxable", "hidden xl:table-cell")}>Fiscale</TableHead>
            <TableHead className={cv("location", "hidden xl:table-cell")}>
              Localit&agrave;
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((service) => (
            <ServiceRow
              key={service.id}
              service={service}
              link={createPath({
                resource: "services",
                type: "show",
                id: service.id,
              })}
            />
          ))}
        </TableBody>
      </Table>
      <ListBulkToolbar allowDelete />
    </>
  );
};

/* ---- Mobile card ---- */
const ServiceMobileCard = ({
  service,
  link,
}: {
  service: Service;
  link: string;
}) => {
  const { data: project } = useGetOne(
    "projects",
    { id: service.project_id! },
    { enabled: !!service.project_id },
  );
  const { serviceTypeChoices } = useConfigurationContext();
  const total = calculateServiceNetValue(service);
  const typeLabel =
    serviceTypeChoices.find((t) => t.value === service.service_type)?.label ??
    service.service_type;

  return (
    <Link
      to={link}
      className="flex flex-col gap-1 px-1 py-3 active:bg-muted/50"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {formatDateRange(
            service.service_date,
            service.service_end,
            service.all_day,
          )}
        </span>
        <span className="text-xs text-muted-foreground">{typeLabel}</span>
      </div>
      <span className="text-base font-bold">
        {service.description || project?.name || ""}
      </span>
      <div className="flex items-center justify-between">
        {service.location ? (
          <span className="text-xs text-muted-foreground">
            {service.location}
          </span>
        ) : (
          <span />
        )}
        <span className="text-sm font-semibold tabular-nums">
          EUR {eur(total)}
        </span>
      </div>
    </Link>
  );
};

/* ---- Desktop table row ---- */
const ServiceRow = ({ service, link }: { service: Service; link: string }) => {
  const { cv } = useColumnVisibility("services", SERVICE_COLUMNS);
  const { data: project } = useGetOne(
    "projects",
    { id: service.project_id! },
    { enabled: !!service.project_id },
  );
  const { serviceTypeChoices } = useConfigurationContext();
  const total = calculateServiceNetValue(service);

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50">
      <TableCell className="w-10">
        <ListRowCheckbox id={service.id} />
      </TableCell>
      <TableCell className={cv("date", "text-sm")}>
        <Link to={link} className="text-primary hover:underline">
          {formatDateRange(
            service.service_date,
            service.service_end,
            service.all_day,
          )}
        </Link>
      </TableCell>
      <TableCell className={cv("project", "text-sm text-muted-foreground")}>
        {project?.name ?? ""}
      </TableCell>
      <TableCell className={cv("type", "text-sm")}>
        <div className="flex items-center gap-2">
          <ServiceIconAvatar type={service.service_type} />
          <span>
            {serviceTypeChoices.find((t) => t.value === service.service_type)
              ?.label ?? service.service_type}
          </span>
        </div>
      </TableCell>
      <TableCell className={cv("description", "text-sm text-muted-foreground hidden lg:table-cell")}>
        {service.description ?? ""}
      </TableCell>
      <TableCell className={cv("fee_shooting", "text-right text-sm hidden md:table-cell")}>
        {eur(service.fee_shooting)}
      </TableCell>
      <TableCell className={cv("fee_editing", "text-right text-sm hidden md:table-cell")}>
        {eur(service.fee_editing)}
      </TableCell>
      <TableCell className={cv("fee_other", "text-right text-sm hidden lg:table-cell")}>
        {eur(service.fee_other)}
      </TableCell>
      <TableCell className={cv("total", "text-right text-sm font-medium")}>
        {eur(total)}
      </TableCell>
      <TableCell className={cv("km", "text-right text-sm hidden lg:table-cell")}>
        {service.km_distance || "--"}
      </TableCell>
      <TableCell className={cv("taxable", "text-sm hidden xl:table-cell")}>
        {service.is_taxable === false ? "Non tassabile" : "Tassabile"}
      </TableCell>
      <TableCell className={cv("location", "text-sm text-muted-foreground hidden xl:table-cell")}>
        {service.location ?? ""}
      </TableCell>
    </TableRow>
  );
};
