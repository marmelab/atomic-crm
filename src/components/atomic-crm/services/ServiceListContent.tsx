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

import type { Service } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { ErrorMessage } from "../misc/ErrorMessage";
import { formatDateRange } from "../misc/formatDateRange";
import { calculateServiceNetValue } from "@/lib/semantics/crmSemanticRegistry";

const eur = (n: number) =>
  n ? n.toLocaleString("it-IT", { minimumFractionDigits: 2 }) : "--";

export const ServiceListContent = () => {
  const { data, isPending, error } = useListContext<Service>();
  const createPath = useCreatePath();
  const isMobile = useIsMobile();

  if (error) return <ErrorMessage />;
  if (isPending || !data) return null;

  if (isMobile) {
    return (
      <div className="flex flex-col divide-y px-4">
        {data.map((service) => (
          <ServiceMobileCard
            key={service.id}
            service={service}
            link={createPath({
              resource: "services",
              type: "show",
              id: service.id,
            })}
          />
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Data</TableHead>
          <TableHead>Progetto</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead className="text-right hidden md:table-cell">
            Riprese
          </TableHead>
          <TableHead className="text-right hidden md:table-cell">
            Montaggio
          </TableHead>
          <TableHead className="text-right hidden lg:table-cell">
            Altro
          </TableHead>
          <TableHead className="text-right">Totale</TableHead>
          <TableHead className="text-right hidden lg:table-cell">Km</TableHead>
          <TableHead className="hidden xl:table-cell">Fiscale</TableHead>
          <TableHead className="hidden xl:table-cell">
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
      <span className="text-sm font-medium">{project?.name ?? ""}</span>
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
  const { data: project } = useGetOne(
    "projects",
    { id: service.project_id! },
    { enabled: !!service.project_id },
  );
  const { serviceTypeChoices } = useConfigurationContext();
  const total = calculateServiceNetValue(service);

  return (
    <TableRow className="cursor-pointer hover:bg-muted/50">
      <TableCell className="text-sm">
        <Link to={link} className="text-primary hover:underline">
          {formatDateRange(
            service.service_date,
            service.service_end,
            service.all_day,
          )}
        </Link>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {project?.name ?? ""}
      </TableCell>
      <TableCell className="text-sm">
        {serviceTypeChoices.find((t) => t.value === service.service_type)
          ?.label ?? service.service_type}
      </TableCell>
      <TableCell className="text-right text-sm hidden md:table-cell">
        {eur(service.fee_shooting)}
      </TableCell>
      <TableCell className="text-right text-sm hidden md:table-cell">
        {eur(service.fee_editing)}
      </TableCell>
      <TableCell className="text-right text-sm hidden lg:table-cell">
        {eur(service.fee_other)}
      </TableCell>
      <TableCell className="text-right text-sm font-medium">
        {eur(total)}
      </TableCell>
      <TableCell className="text-right text-sm hidden lg:table-cell">
        {service.km_distance || "--"}
      </TableCell>
      <TableCell className="text-sm hidden xl:table-cell">
        {service.is_taxable === false ? "Non tassabile" : "Tassabile"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground hidden xl:table-cell">
        {service.location ?? ""}
      </TableCell>
    </TableRow>
  );
};
