import { ShowBase, useGetList, useGetOne, useShowContext } from "ra-core";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { Calendar, Wallet, User, Euro, Car, Hash } from "lucide-react";
import { Link, useLocation } from "react-router";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Payment, Project, Service } from "../types";
import { ProjectCategoryBadge, ProjectStatusBadge } from "./ProjectListContent";
import { projectTvShowLabels } from "./projectTypes";
import { QuickEpisodeDialog } from "./QuickEpisodeDialog";
import { QuickPaymentDialog } from "./QuickPaymentDialog";
import { ErrorMessage } from "../misc/ErrorMessage";
import { MobileBackButton } from "../misc/MobileBackButton";
import { formatDateRange } from "../misc/formatDateRange";
import { getUnifiedAiHandoffContextFromSearch } from "../payments/paymentLinking";
import { ProjectContactsSection } from "../contacts/ProjectContactsSection";
import { InvoiceDraftDialog } from "../invoicing/InvoiceDraftDialog";
import { buildInvoiceDraftFromProject } from "../invoicing/buildInvoiceDraftFromProject";
import { hasInvoiceDraftCollectableAmount } from "../invoicing/invoiceDraftTypes";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { formatCurrencyPrecise } from "../dashboard/dashboardFormatters";

export const ProjectShow = () => (
  <ShowBase>
    <ProjectShowContent />
  </ShowBase>
);

const ProjectShowContent = () => {
  const { record, isPending, error } = useShowContext<Project>();
  const location = useLocation();
  const launcherHandoff = getUnifiedAiHandoffContextFromSearch(location.search);
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
      {launcherHandoff?.action === "project_quick_payment" ? (
        <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {launcherHandoff.draftKind === "project_quick_payment"
            ? "Aperto dalla chat AI unificata con una bozza quick payment: questo progetto e' la superficie approvata dove controllare e confermare il pagamento."
            : "Aperto dalla chat AI unificata: questo progetto e' stato indicato come superficie giusta per il quick payment gia approvato."}
        </div>
      ) : launcherHandoff?.action === "project_quick_episode" ? (
        <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Aperto dalla chat AI unificata: questo progetto e' la superficie
          approvata dove controllare e confermare la registrazione della
          puntata.
        </div>
      ) : null}
      <Card>
        <CardContent>
          <ProjectHeader record={record} />
          <Separator className="my-4" />
          <ProjectDetails record={record} />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <ProjectContactsSection project={record} />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Riepilogo finanziario
          </h3>
          <ProjectFinancials projectId={String(record.id)} />
        </CardContent>
      </Card>
    </div>
  );
};

const ProjectHeader = ({ record }: { record: Project }) => {
  const [invoiceDraftOpen, setInvoiceDraftOpen] = useState(false);
  const location = useLocation();
  const { operationalConfig } = useConfigurationContext();
  const { data: client } = useGetOne("clients", { id: record.client_id });
  const { data: services = [] } = useGetList<Service>("services", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "service_date", order: "DESC" },
    filter: { "project_id@eq": String(record.id) },
  });
  const { data: projectPayments = [] } = useGetList<Payment>("payments", {
    pagination: { page: 1, perPage: 1000 },
    sort: { field: "payment_date", order: "DESC" },
    filter: { "project_id@eq": String(record.id) },
  });
  const invoiceDraft = client
    ? buildInvoiceDraftFromProject({
        project: record,
        client,
        services,
        payments: projectPayments,
        defaultKmRate: operationalConfig.defaultKmRate,
      })
    : null;
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
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {client && (
            <Link
              to={`/clients/${record.client_id}/show`}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              <User className="size-3" />
              {client.name}
            </Link>
          )}
          <ProjectCategoryBadge category={record.category} />
          {record.tv_show && (
            <span className="text-sm text-muted-foreground">
              {projectTvShowLabels[record.tv_show]}
            </span>
          )}
          <ProjectStatusBadge status={record.status} />
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
        {record.category === "produzione_tv" && (
          <QuickEpisodeDialog record={record} />
        )}
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
        <QuickPaymentDialog record={record} />
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

const ProjectDetails = ({ record }: { record: Project }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    <div className="space-y-3">
      <h6 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Date e budget
      </h6>
      {record.start_date && (
        <InfoRow
          icon={<Calendar className="size-4" />}
          label="Periodo"
          value={formatDateRange(
            record.start_date,
            record.end_date,
            record.all_day,
          )}
        />
      )}
      {record.budget != null && record.budget > 0 && (
        <InfoRow
          icon={<Wallet className="size-4" />}
          label="Budget"
          value={formatCurrencyPrecise(record.budget)}
        />
      )}
    </div>
    {record.notes && (
      <div className="space-y-3">
        <h6 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Note
        </h6>
        <p className="text-sm whitespace-pre-wrap">{record.notes}</p>
      </div>
    )}
  </div>
);

const eur = (n: number) =>
  n.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const ProjectFinancials = ({ projectId }: { projectId: string }) => {
  const { data, isPending } = useGetOne("project_financials", {
    id: projectId,
  });

  if (isPending) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  const totalFees = toNum(data.total_fees);
  const totalExpenses = toNum(data.total_expenses);
  const totalServices = toNum(data.total_services);
  const totalOwed = toNum(data.total_owed);
  const totalPaid = toNum(data.total_paid);
  const balanceDue = toNum(data.balance_due);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <MetricCard
        icon={<Hash className="size-4" />}
        label="Servizi"
        value={String(totalServices)}
      />
      <MetricCard
        icon={<Euro className="size-4" />}
        label="Compensi"
        value={eur(totalFees)}
      />
      <MetricCard
        icon={<Car className="size-4" />}
        label="Spese"
        value={eur(totalExpenses)}
      />
      <MetricCard
        icon={<Wallet className="size-4" />}
        label="Totale"
        value={eur(totalOwed)}
        className="font-bold"
      />
      <MetricCard
        icon={<Euro className="size-4" />}
        label="Pagato"
        value={eur(totalPaid)}
        className="text-green-600"
      />
      <MetricCard
        icon={<Wallet className="size-4" />}
        label={balanceDue < 0 ? "Credito cliente" : "Da incassare"}
        value={eur(Math.abs(balanceDue))}
        className={
          balanceDue > 0
            ? "text-orange-600 font-bold"
            : "text-green-600 font-bold"
        }
      />
    </div>
  );
};

const MetricCard = ({
  icon,
  label,
  value,
  sub,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) => (
  <div className="rounded-lg border bg-card p-3">
    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
      {icon}
      {label}
    </div>
    <div className={`text-base font-semibold ${className ?? ""}`}>{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
  </div>
);

const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex items-center gap-2 text-sm">
    <span className="text-muted-foreground">{icon}</span>
    <span className="text-muted-foreground font-medium">{label}:</span>
    <span>{value}</span>
  </div>
);
