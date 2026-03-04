import { ShowBase, useGetList, useShowContext } from "ra-core";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { Phone, Mail, MapPin, FileText, Euro } from "lucide-react";
import { Link, useLocation } from "react-router";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Client, Project, Service } from "../types";
import { ClientTypeBadge } from "./ClientListContent";
import { clientSourceLabels } from "./clientTypes";
import {
  formatClientBillingAddress,
  getClientBillingIdentityLines,
  getClientDistinctBillingName,
} from "./clientBilling";
import { ClientTagsListEdit } from "../tags/ClientTagsListEdit";
import { ClientNotesSection } from "./ClientNotesSection";
import { ClientTasksSection } from "./ClientTasksSection";
import { ClientFinancialSummary } from "./ClientFinancialSummary";
import { ErrorMessage } from "../misc/ErrorMessage";
import { MobileBackButton } from "../misc/MobileBackButton";
import { buildPaymentCreatePathFromClient } from "../payments/paymentLinking";
import { ClientContactsSection } from "../contacts/ClientContactsSection";
import { InvoiceDraftDialog } from "../invoicing/InvoiceDraftDialog";
import { buildInvoiceDraftFromClient } from "../invoicing/buildInvoiceDraftFromClient";
import { hasInvoiceDraftCollectableAmount } from "../invoicing/invoiceDraftTypes";
import { useConfigurationContext } from "../root/ConfigurationContext";

export const ClientShow = () => (
  <ShowBase>
    <ClientShowContent />
  </ShowBase>
);

const ClientShowContent = () => {
  const { record, isPending, error } = useShowContext<Client>();
  const isMobile = useIsMobile();

  if (error) return <ErrorMessage />;
  if (isPending || !record) return null;

  return (
    <div className="mt-4 mb-28 md:mb-2 flex flex-col gap-6 px-4 md:px-0">
      {isMobile && (
        <div className="mb-3">
          <MobileBackButton />
        </div>
      )}
      <Card>
        <CardContent>
          <ClientHeader record={record} />
          <Separator className="my-4" />
          <ClientDetails record={record} />
          <Separator className="my-4" />
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Etichette
            </h3>
            <ClientTagsListEdit />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Riepilogo finanziario
          </h3>
          <ClientFinancialSummary record={record} />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <ClientContactsSection />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <ClientTasksSection />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <ClientNotesSection />
        </CardContent>
      </Card>
    </div>
  );
};

const ClientHeader = ({ record }: { record: Client }) => {
  const [invoiceDraftOpen, setInvoiceDraftOpen] = useState(false);
  const location = useLocation();
  const { operationalConfig } = useConfigurationContext();
  const { data: services = [] } = useGetList<Service>("services", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "service_date", order: "DESC" },
    filter: { "client_id@eq": String(record.id) },
  });
  const { data: projects = [] } = useGetList<Project>("projects", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "name", order: "ASC" },
    filter: { "client_id@eq": String(record.id) },
  });
  const invoiceDraft = buildInvoiceDraftFromClient({
    client: record,
    services,
    projects,
    defaultKmRate: operationalConfig.defaultKmRate,
  });
  const hasCollectableAmount = hasInvoiceDraftCollectableAmount(invoiceDraft);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("invoiceDraft") === "true" && hasCollectableAmount) {
      setInvoiceDraftOpen(true);
    }
  }, [hasCollectableAmount, location.search]);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-2xl font-bold">{record.name}</h2>
        <div className="flex items-center gap-2 mt-1">
          <ClientTypeBadge type={record.client_type} />
          {record.source && (
            <span className="text-sm text-muted-foreground">
              {clientSourceLabels[record.source]}
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
        <Button asChild size="sm" variant="outline">
          <Link
            to={buildPaymentCreatePathFromClient({
              client: { client_id: record.id },
            })}
          >
            <Euro className="mr-1 size-4" />
            Nuovo pagamento
          </Link>
        </Button>
        {hasCollectableAmount ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
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
        draft={hasCollectableAmount ? invoiceDraft : null}
      />
    </div>
  );
};

const ClientDetails = ({ record }: { record: Client }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div className="space-y-3">
      <h6 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Contatti
      </h6>
      {record.phone && (
        <InfoRow icon={<Phone className="size-4" />} value={record.phone} />
      )}
      {record.email && (
        <InfoRow icon={<Mail className="size-4" />} value={record.email} />
      )}
      {record.address && (
        <InfoRow icon={<MapPin className="size-4" />} value={record.address} />
      )}
    </div>
    <div className="space-y-3">
      <h6 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Fatturazione
      </h6>
      {getClientDistinctBillingName(record) && (
        <InfoRow
          icon={<FileText className="size-4" />}
          label="Denominazione"
          value={getClientDistinctBillingName(record) ?? ""}
        />
      )}
      {formatClientBillingAddress(record) && (
        <InfoRow
          icon={<MapPin className="size-4" />}
          label="Indirizzo fiscale"
          value={formatClientBillingAddress(record) ?? ""}
        />
      )}
      {getClientBillingIdentityLines(record).map((line) => (
        <InfoRow
          key={line}
          icon={<FileText className="size-4" />}
          value={line}
        />
      ))}
    </div>
    {record.notes ? (
      <div className="space-y-3 md:col-span-2">
        <h6 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Note generali
        </h6>
        <p className="text-sm whitespace-pre-wrap">{record.notes}</p>
      </div>
    ) : null}
  </div>
);

const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label?: string;
  value: string;
}) => (
  <div className="flex items-center gap-2 text-sm">
    <span className="text-muted-foreground">{icon}</span>
    {label && (
      <span className="text-muted-foreground font-medium">{label}:</span>
    )}
    <span>{value}</span>
  </div>
);
