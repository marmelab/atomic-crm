import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  FileCheck2,
  Gauge,
  Globe2,
  Search,
  Send,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";
import { useNavigate } from "react-router";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";

import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import type {
  CustomerPerformanceCategory,
  CustomerPortfolioViewModel,
  CustomerReportDeliveryStatus,
  CustomerVisibilityRow,
} from "../types";
import type { VisibilityDataProvider } from "../companies/visibility/types";
import { CustomerPerformanceMap } from "./CustomerPerformanceMap";
import { CustomerPortfolioTrendChart } from "./CustomerPortfolioTrendChart";
import { CustomerVisibilityDetailSheet } from "./CustomerVisibilityDetailSheet";
import {
  CustomerVisibilityTable,
  type CustomerTableSort,
} from "./CustomerVisibilityTable";
import {
  buildCustomerPortfolioViewModel,
  previousCompleteMonth,
} from "./portfolioModel";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  REPORT_STATUS_LABELS,
} from "./customerVisibilityUi";

const DEFAULT_PERIOD = previousCompleteMonth();
const CATEGORY_RANK: Record<CustomerPerformanceCategory, number> = {
  poor: 0,
  watch: 1,
  missing: 2,
  good: 3,
  very_good: 4,
};

function periodOptions() {
  const result: string[] = [];
  const start = new Date(`${DEFAULT_PERIOD}T00:00:00Z`);
  for (let index = 0; index < 12; index += 1) {
    result.push(
      new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - index, 1),
      )
        .toISOString()
        .slice(0, 10),
    );
  }
  return result;
}

export function CustomerVisibilityPage() {
  const dataProvider = useDataProvider<VisibilityDataProvider>();
  const notify = useNotify();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [period, setPeriod] = useState(DEFAULT_PERIOD);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CustomerPerformanceCategory | "all">(
    "all",
  );
  const [reportStatus, setReportStatus] = useState<
    CustomerReportDeliveryStatus | "all"
  >("all");
  const [sort, setSort] = useState<CustomerTableSort>("category");
  const [selectedRow, setSelectedRow] =
    useState<CustomerVisibilityRow | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ["customer-visibility-dashboard", period],
    queryFn: () => dataProvider.getCustomerVisibilityDashboard(period),
  });
  const model = useMemo(
    () =>
      dashboardQuery.data
        ? buildCustomerPortfolioViewModel(dashboardQuery.data)
        : null,
    [dashboardQuery.data],
  );

  const filteredRows = useMemo(() => {
    if (!model) return [];
    const query = search.trim().toLocaleLowerCase("sv-SE");
    return model.rows
      .filter(
        (row) =>
          (!query ||
            row.companyName.toLocaleLowerCase("sv-SE").includes(query) ||
            row.websiteUrl.toLocaleLowerCase("sv-SE").includes(query)) &&
          (category === "all" || row.category === category) &&
          (reportStatus === "all" || row.reportStatus === reportStatus),
      )
      .sort((a, b) => {
        if (sort === "company") {
          return a.companyName.localeCompare(b.companyName, "sv-SE");
        }
        if (sort === "clicks") {
          return (
            ((b.viewModel?.metrics.clicks as { current?: number | null })
              ?.current ?? -1) -
            ((a.viewModel?.metrics.clicks as { current?: number | null })
              ?.current ?? -1)
          );
        }
        if (sort === "position") {
          return (
            ((a.viewModel?.metrics.position as { current?: number | null })
              ?.current ?? Number.POSITIVE_INFINITY) -
            ((b.viewModel?.metrics.position as { current?: number | null })
              ?.current ?? Number.POSITIVE_INFINITY)
          );
        }
        return CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
      });
  }, [category, model, reportStatus, search, sort]);

  const handleAnalyze = async (row: CustomerVisibilityRow) => {
    if (!model) return;
    setBusyAction(`analyze-${row.companyId}`);
    try {
      await dataProvider.analyzeWebsite(row.companyId, {
        window_kind: "calendar_month",
        start_date: model.period.start,
        end_date: model.period.end,
      });
      await dashboardQuery.refetch();
      notify(`${row.companyName} har analyserats om för vald månad`, {
        type: "success",
      });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Analysen kunde inte köras",
        { type: "warning" },
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleGenerateReport = async (row: CustomerVisibilityRow) => {
    if (row.report) {
      navigate(
        `/companies/${row.companyId}/show/customer?report=${row.report.id}`,
      );
      return;
    }
    if (period !== DEFAULT_PERIOD) {
      notify(
        "Historiska rapporter granskas från kundbilden. Ny rapport kan skapas för senaste kompletta månad.",
        { type: "info" },
      );
      return;
    }
    setBusyAction(`report-${row.companyId}`);
    try {
      const result = await dataProvider.generateMonthlyReport(row.companyId);
      await dashboardQuery.refetch();
      notify(`Rapportutkast skapat för ${row.companyName}`, {
        type: "success",
      });
      if (result.report_id != null) {
        navigate(
          `/companies/${row.companyId}/show/customer?report=${result.report_id}`,
        );
      }
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Rapporten kunde inte skapas",
        { type: "warning" },
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownloadPdf = async (row: CustomerVisibilityRow) => {
    if (!row.report) return;
    setBusyAction(`pdf-${row.companyId}`);
    try {
      const result = await dataProvider.getMonthlyReportPdf(row.report.id);
      window.open(result.signed_url, "_blank", "noopener,noreferrer");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "PDF:en kunde inte öppnas",
        { type: "warning" },
      );
    } finally {
      setBusyAction(null);
    }
  };

  const content = (
    <CustomerVisibilityContent
      model={model}
      isPending={dashboardQuery.isPending}
      error={dashboardQuery.error}
      period={period}
      search={search}
      category={category}
      reportStatus={reportStatus}
      sort={sort}
      filteredRows={filteredRows}
      onPeriodChange={setPeriod}
      onSearchChange={setSearch}
      onCategoryChange={setCategory}
      onReportStatusChange={setReportStatus}
      onSort={setSort}
      onSelect={setSelectedRow}
      onRetry={() => dashboardQuery.refetch()}
    />
  );

  return (
    <>
      {isMobile ? (
        <>
          <MobileHeader>
            <div>
              <p className="text-xs text-muted-foreground">Översikt</p>
              <h1 className="text-lg font-semibold">Kundradar</h1>
            </div>
          </MobileHeader>
          <MobileContent onRefresh={() => dashboardQuery.refetch()}>
            {content}
          </MobileContent>
        </>
      ) : (
        <main className="mt-1">{content}</main>
      )}
      <CustomerVisibilityDetailSheet
        row={selectedRow}
        open={selectedRow != null}
        busyAction={busyAction}
        onOpenChange={(open) => {
          if (!open) setSelectedRow(null);
        }}
        onAnalyze={handleAnalyze}
        onGenerateReport={handleGenerateReport}
        onDownloadPdf={handleDownloadPdf}
      />
    </>
  );
}

function CustomerVisibilityContent({
  model,
  isPending,
  error,
  period,
  search,
  category,
  reportStatus,
  sort,
  filteredRows,
  onPeriodChange,
  onSearchChange,
  onCategoryChange,
  onReportStatusChange,
  onSort,
  onSelect,
  onRetry,
}: {
  model: CustomerPortfolioViewModel | null;
  isPending: boolean;
  error: Error | null;
  period: string;
  search: string;
  category: CustomerPerformanceCategory | "all";
  reportStatus: CustomerReportDeliveryStatus | "all";
  sort: CustomerTableSort;
  filteredRows: CustomerVisibilityRow[];
  onPeriodChange: (period: string) => void;
  onSearchChange: (search: string) => void;
  onCategoryChange: (category: CustomerPerformanceCategory | "all") => void;
  onReportStatusChange: (
    status: CustomerReportDeliveryStatus | "all",
  ) => void;
  onSort: (sort: CustomerTableSort) => void;
  onSelect: (row: CustomerVisibilityRow) => void;
  onRetry: () => void;
}) {
  if (isPending) return <DashboardSkeleton />;
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="size-4" />
        <AlertTitle>Kundradarn kunde inte laddas</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{error.message}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Försök igen
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (!model) return null;

  const attention = model.rows
    .filter((row) => row.category === "poor" || row.category === "watch")
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="hidden items-center gap-2 md:flex">
            <BarChart3 className="size-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Kundradar
            </h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Samma verifierade webbstatistik som i kundbilden och
            kundrapporten, samlad för hela portföljen.
          </p>
        </div>
        <Select value={period} onValueChange={onPeriodChange}>
          <SelectTrigger className="w-full lg:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periodOptions().map((option) => (
              <SelectItem key={option} value={option}>
                {new Date(`${option}T00:00:00Z`).toLocaleDateString("sv-SE", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <SummaryCard
          icon={Users}
          label="Levererade sajter"
          value={String(model.metrics.customers)}
          helper={`${model.metrics.searchCustomers} med Search Console-data`}
        />
        <SummaryCard
          icon={Globe2}
          label="Google-klick"
          value={
            model.metrics.clicks?.toLocaleString("sv-SE") ?? "Data saknas"
          }
          helper={`${model.metrics.searchCustomers} kunder ingår`}
        />
        <SummaryCard
          icon={TrendingUp}
          label="Förbättrats"
          value={String(model.metrics.improved)}
          helper={`${model.metrics.declined} har försämrats`}
        />
        <SummaryCard
          icon={Gauge}
          label="Core Web Vitals"
          value={`${model.metrics.healthyCoreWebVitals}/${model.metrics.coreWebVitalsCustomers}`}
          helper="kunder med bra verklig fältdata"
        />
        <SummaryCard
          icon={Send}
          label="Rapporter skickade"
          value={`${model.reports.sent}/${model.metrics.customers}`}
          helper={`${model.reports.draft + model.reports.missing + model.reports.failed} återstår`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {CATEGORY_ORDER.map((item) => (
          <Card key={item} className="gap-2 py-4">
            <CardContent className="flex items-center justify-between px-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  {CATEGORY_LABELS[item]}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {model.counts[item]}
                </p>
              </div>
              {item === "very_good" || item === "good" ? (
                <CheckCircle2 className="size-5 text-emerald-600" />
              ) : item === "poor" ? (
                <TrendingDown className="size-5 text-red-600" />
              ) : (
                <AlertTriangle className="size-5 text-amber-600" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {attention.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              Behöver uppmärksamhet
            </CardTitle>
            <CardDescription>
              Högst prioriterade kundwebbplatser för vald månad.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {attention.map((row) => (
              <Button
                key={row.companyId}
                variant="outline"
                className="h-auto justify-start whitespace-normal p-3 text-left"
                onClick={() => onSelect(row)}
              >
                <div>
                  <p className="font-semibold">{row.companyName}</p>
                  <p className="mt-1 line-clamp-2 text-xs font-normal text-muted-foreground">
                    {row.reasons[0]?.label}
                  </p>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <CustomerPortfolioTrendChart model={model} />

      <Card className="gap-4 py-4">
        <CardContent className="grid gap-3 px-4 lg:grid-cols-[1fr_220px_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Sök kund eller webbplats"
              className="pl-9"
            />
          </div>
          <Select
            value={category}
            onValueChange={(value) =>
              onCategoryChange(value as CustomerPerformanceCategory | "all")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Alla kategorier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla kategorier</SelectItem>
              {CATEGORY_ORDER.map((item) => (
                <SelectItem key={item} value={item}>
                  {CATEGORY_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={reportStatus}
            onValueChange={(value) =>
              onReportStatusChange(
                value as CustomerReportDeliveryStatus | "all",
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Alla rapportstatusar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alla rapportstatusar</SelectItem>
              {Object.entries(REPORT_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <CustomerPerformanceMap rows={filteredRows} onSelect={onSelect} />
      <CustomerVisibilityTable
        rows={filteredRows}
        sort={sort}
        onSort={onSort}
        onSelect={onSelect}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CompactMetric
          icon={Globe2}
          label="Portföljens CTR"
          value={
            model.metrics.ctr == null
              ? "Saknas"
              : `${(model.metrics.ctr * 100).toFixed(1)} %`
          }
          coverage={`${model.metrics.searchCustomers} kunder`}
        />
        <CompactMetric
          icon={FileCheck2}
          label="Viktad snittposition"
          value={
            model.metrics.position == null
              ? "Saknas"
              : model.metrics.position.toFixed(1)
          }
          coverage={`${model.metrics.searchCustomers} kunder`}
        />
        <CompactMetric
          icon={Gauge}
          label="Genomsnittlig prestanda"
          value={
            model.metrics.performance == null
              ? "Saknas"
              : `${Math.round(model.metrics.performance)}/100`
          }
          coverage="endast uppmätta sajter"
        />
        <CompactMetric
          icon={Globe2}
          label="Google Business"
          value={
            model.metrics.googleBusinessRating == null
              ? "Saknas"
              : `${model.metrics.googleBusinessRating.toFixed(1)} i betyg`
          }
          coverage={`${model.metrics.googleBusinessCustomers} kunder · ${model.metrics.reviews ?? 0} recensioner`}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Card className="gap-3 py-4">
      <CardContent className="px-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

function CompactMetric({
  icon: Icon,
  label,
  value,
  coverage,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  coverage: string;
}) {
  return (
    <Card className="gap-2 py-4">
      <CardContent className="px-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="size-4" />
          {label}
        </div>
        <p className="mt-2 font-semibold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{coverage}</p>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-9 w-52" />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
