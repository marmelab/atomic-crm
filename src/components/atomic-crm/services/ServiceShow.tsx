import { ShowBase, useShowContext, useGetOne } from "ra-core";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { Calendar, MapPin, FileText } from "lucide-react";
import { Link, useLocation } from "react-router";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Service } from "../types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { ErrorMessage } from "../misc/ErrorMessage";
import { MobileBackButton } from "../misc/MobileBackButton";
import { formatDateRange } from "../misc/formatDateRange";
import {
  calculateKmReimbursement,
  calculateServiceNetValue,
} from "@/lib/semantics/crmSemanticRegistry";
import { InvoiceDraftDialog } from "../invoicing/InvoiceDraftDialog";
import { buildInvoiceDraftFromService } from "../invoicing/buildInvoiceDraftFromService";

const eur = (n: number) =>
  n.toLocaleString("it-IT", { minimumFractionDigits: 2 });

export const ServiceShow = () => (
  <ShowBase>
    <ServiceShowContent />
  </ShowBase>
);

const ServiceShowContent = () => {
  const { record, isPending, error } = useShowContext<Service>();
  const { operationalConfig } = useConfigurationContext();
  const isMobile = useIsMobile();

  if (error) return <ErrorMessage />;
  if (isPending || !record) return null;

  const total = calculateServiceNetValue(record);
  const kmReimbursement = calculateKmReimbursement({
    kmDistance: record.km_distance,
    kmRate: record.km_rate,
    defaultKmRate: operationalConfig.defaultKmRate,
  });

  return (
    <div className="mt-4 mb-28 md:mb-2 flex gap-4 md:gap-8 px-4 md:px-0">
      <div className="flex-1">
        {isMobile && (
          <div className="mb-3">
            <MobileBackButton />
          </div>
        )}
        <Card>
          <CardContent>
            <ServiceHeader record={record} />
            <Separator className="my-4" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ServiceFees record={record} total={total} />
              <ServiceKmDetails
                record={record}
                defaultKmRate={operationalConfig.defaultKmRate}
                kmReimbursement={kmReimbursement}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const ServiceHeader = ({ record }: { record: Service }) => {
  const [invoiceDraftOpen, setInvoiceDraftOpen] = useState(false);
  const location = useLocation();
  const { data: project } = useGetOne(
    "projects",
    { id: record.project_id! },
    { enabled: !!record.project_id },
  );
  const { serviceTypeChoices, operationalConfig } = useConfigurationContext();
  const { data: client } = useGetOne(
    "clients",
    { id: record.client_id ?? project?.client_id },
    { enabled: !!record.client_id || !!project?.client_id },
  );
  const invoiceDraft = client
    ? buildInvoiceDraftFromService({
        service: record,
        client,
        defaultKmRate: operationalConfig.defaultKmRate,
      })
    : null;

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("invoiceDraft") === "true" && invoiceDraft) {
      setInvoiceDraftOpen(true);
    }
  }, [invoiceDraft, location.search]);

  const serviceLabel =
    serviceTypeChoices.find((t) => t.value === record.service_type)?.label ??
    record.service_type;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-2xl font-bold">{serviceLabel}</h2>
        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
          <Badge
            variant={record.is_taxable === false ? "secondary" : "outline"}
          >
            {record.is_taxable === false ? "Non tassabile" : "Tassabile"}
          </Badge>
          <span className="flex items-center gap-1">
            <Calendar className="size-3" />
            {formatDateRange(
              record.service_date,
              record.service_end,
              record.all_day,
            )}
          </span>
          {project && (
            <Link
              to={`/projects/${record.project_id}/show`}
              className="text-primary hover:underline"
            >
              {project.name}
            </Link>
          )}
          {record.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {record.location}
            </span>
          )}
          {record.invoice_ref && (
            <span className="flex items-center gap-1">
              <FileText className="size-3" />
              {record.invoice_ref}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        {invoiceDraft ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setInvoiceDraftOpen(true)}
          >
            Genera bozza fattura
          </Button>
        ) : null}
        <EditButton />
        <DeleteButton redirect="list" />
      </div>
      <InvoiceDraftDialog
        open={invoiceDraftOpen}
        onOpenChange={setInvoiceDraftOpen}
        draft={invoiceDraft}
      />
    </div>
  );
};

const ServiceFees = ({ record, total }: { record: Service; total: number }) => (
  <div className="space-y-2">
    <h6 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
      Compensi
    </h6>
    {record.fee_shooting > 0 && (
      <FeeRow label="Riprese" value={record.fee_shooting} />
    )}
    {record.fee_editing > 0 && (
      <FeeRow label="Montaggio" value={record.fee_editing} />
    )}
    {record.fee_other > 0 && <FeeRow label="Altro" value={record.fee_other} />}
    {record.discount > 0 && <FeeRow label="Sconto" value={-record.discount} />}
    <div className="border-t pt-2 flex justify-between font-bold">
      <span>Totale</span>
      <span>EUR {eur(total)}</span>
    </div>
  </div>
);

const ServiceKmDetails = ({
  record,
  defaultKmRate,
  kmReimbursement,
}: {
  record: Service;
  defaultKmRate: number;
  kmReimbursement: number;
}) => (
  <div className="space-y-2">
    <h6 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
      Spostamento
    </h6>
    <FeeRow
      label="Km percorsi"
      value={record.km_distance}
      currency={false}
      suffix=" km"
    />
    <FeeRow
      label={`Tariffa (EUR ${eur(record.km_rate ?? defaultKmRate)}/km)`}
      value={kmReimbursement}
    />
    {record.notes && (
      <>
        <h6 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pt-3">
          Note
        </h6>
        <p className="text-sm whitespace-pre-wrap">{record.notes}</p>
      </>
    )}
  </div>
);

const FeeRow = ({
  label,
  value,
  currency = true,
  suffix = "",
}: {
  label: string;
  value: number;
  currency?: boolean;
  suffix?: string;
}) => (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span>
      {currency ? "EUR " : ""}
      {eur(value)}
      {suffix}
    </span>
  </div>
);
