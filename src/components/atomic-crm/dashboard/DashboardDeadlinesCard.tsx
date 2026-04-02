import { useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  ListChecks,
  Undo2,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { formatBusinessDate } from "@/lib/dateTimezone";

import { buildFiscalDeadlineKey } from "./buildFiscalDeadlineKey";
import { formatCurrencyPrecise } from "./dashboardModel";
import type { FiscalDeadline, FiscalPaymentSchedule } from "./fiscalModelTypes";
import type {
  FiscalDeadlineView,
  FiscalDeadlineItemStatus,
} from "./fiscalRealityTypes";
import type { FiscalPaymentRecord } from "./useFiscalPaymentTracking";

export const DashboardDeadlinesCard = ({
  schedule,
  onGenerateTasks,
  existingTasksCount,
  getPayment,
  onMarkPaid,
  onClearPayment,
  deadlineViews,
  onRegisterF24,
  hasRealFiscalData,
}: {
  schedule: FiscalPaymentSchedule;
  onGenerateTasks?: () => void;
  existingTasksCount?: number;
  getPayment?: (deadline: FiscalDeadline) => FiscalPaymentRecord | null;
  onMarkPaid?: (deadline: FiscalDeadline) => void;
  onClearPayment?: (deadline: FiscalDeadline) => void;
  deadlineViews?: FiscalDeadlineView[];
  onRegisterF24?: (deadline: FiscalDeadlineView) => void;
  hasRealFiscalData?: boolean;
}) => {
  // Reality-aware rendering when deadlineViews are provided
  if (deadlineViews != null) {
    return (
      <DeadlinesCardFromViews
        deadlineViews={deadlineViews}
        onGenerateTasks={onGenerateTasks}
        existingTasksCount={existingTasksCount}
        onRegisterF24={onRegisterF24}
        hasRealFiscalData={hasRealFiscalData}
      />
    );
  }

  // Legacy rendering from schedule
  const { deadlines, isFirstYear, paymentYear, basisTaxYear } = schedule;
  const highPriority = deadlines.filter((d) => d.priority === "high");
  const lowPriority = deadlines.filter((d) => d.priority === "low");
  const futureHigh = highPriority.filter((d) => !d.isPast);
  const totalDue = futureHigh.reduce((sum, d) => sum + d.totalAmount, 0);

  if (highPriority.length === 0 && lowPriority.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Scadenze fiscali stimate
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground text-center py-6">
          Nessuna scadenza in programma
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Scadenze fiscali stimate
          </CardTitle>
          {onGenerateTasks && (
            <GenerateButton
              onGenerate={onGenerateTasks}
              existingCount={existingTasksCount ?? 0}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Pagamenti stimati del {paymentYear}, costruiti dai dati fiscali del{" "}
          {basisTaxYear}. "Segna come pagato" resta solo su questo dispositivo.
        </p>
        {isFirstYear && (
          <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">
              Primo anno di attivit&agrave;
            </p>
            <p>
              Nessun versamento stimato di saldo o acconto in questo anno di
              pagamento. Restano separati solo bolli e dichiarazione, se dovuti.
            </p>
          </div>
        )}
        {futureHigh.length > 0 && (
          <div className="flex items-center justify-center gap-2 rounded-md py-2 text-sm font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {futureHigh.length} scadenz{futureHigh.length === 1 ? "a" : "e"} ·{" "}
            {formatCurrencyPrecise(totalDue)} da versare
          </div>
        )}
        {!isFirstYear && futureHigh.length === 0 && highPriority.length > 0 && (
          <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Nessun versamento stimato ancora aperto in questo anno di pagamento.
          </div>
        )}
        {highPriority.map((deadline) => (
          <DeadlineRow
            key={buildFiscalDeadlineKey(deadline)}
            deadline={deadline}
            payment={getPayment?.(deadline) ?? null}
            onMarkPaid={onMarkPaid ? () => onMarkPaid(deadline) : undefined}
            onClearPayment={
              onClearPayment ? () => onClearPayment(deadline) : undefined
            }
          />
        ))}

        {lowPriority.length > 0 && (
          <LowPrioritySection deadlines={lowPriority} />
        )}
      </CardContent>
    </Card>
  );
};

// ── High-priority deadline row (F24/INPS) ──────────────────────────

const DeadlineRow = ({
  deadline,
  payment,
  onMarkPaid,
  onClearPayment,
}: {
  deadline: FiscalDeadline;
  payment: FiscalPaymentRecord | null;
  onMarkPaid?: () => void;
  onClearPayment?: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const isPaid = payment != null;

  const urgencyVariant = isPaid
    ? ("success" as const)
    : deadline.isPast
      ? "secondary"
      : deadline.daysUntil <= 30
        ? "destructive"
        : deadline.daysUntil <= 90
          ? "outline"
          : "secondary";

  const countdownText = isPaid
    ? "Pagato"
    : deadline.isPast
      ? "Passata"
      : deadline.daysUntil === 0
        ? "Oggi"
        : `${deadline.daysUntil}g`;

  const formattedDate = formatBusinessDate(deadline.date, {
    day: "2-digit",
    month: "long",
  });

  return (
    <div
      className={`rounded-md border p-3 space-y-2 ${
        isPaid
          ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
          : deadline.isPast
            ? "opacity-50"
            : ""
      }`}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={urgencyVariant}>{countdownText}</Badge>
          <span className="font-medium">{formattedDate}</span>
          <span className="text-muted-foreground">
            &mdash; {deadline.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">
            {formatCurrencyPrecise(deadline.totalAmount)}
          </span>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="pl-4 space-y-1 text-xs text-muted-foreground border-l-2 ml-2">
          {deadline.items.map((item) => (
            <div key={item.description} className="flex justify-between">
              <span>{item.description}</span>
              <span>{formatCurrencyPrecise(item.amount)}</span>
            </div>
          ))}
        </div>
      )}
      {expanded && deadline.priority === "high" && deadline.totalAmount > 0 && (
        <div className="flex items-center gap-2 pt-1">
          {isPaid ? (
            <>
              <Badge variant="success" className="gap-1 text-[10px]">
                <Check className="h-3 w-3" />
                Pagato {formatCurrencyPrecise(payment.paidAmount)} il{" "}
                {formatBusinessDate(payment.paidDate, {
                  day: "2-digit",
                  month: "short",
                })}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                Promemoria locale
              </span>
              {onClearPayment && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-[10px] text-muted-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClearPayment();
                  }}
                >
                  <Undo2 className="h-3 w-3" />
                  Annulla
                </Button>
              )}
            </>
          ) : (
            onMarkPaid && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 gap-1 text-[10px]"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkPaid();
                }}
              >
                <Check className="h-3 w-3" />
                Segna come pagato qui
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
};

// ── Reality-aware rendering from FiscalDeadlineView[] ─────────────

const STATUS_BADGE_CONFIG: Record<
  FiscalDeadlineItemStatus,
  { label: string; variant: "secondary" | "default" | "outline" | "destructive" | "success" | "warning" }
> = {
  estimated: { label: "Stimato", variant: "secondary" },
  due: { label: "Da dichiarazione", variant: "default" },
  partial: { label: "Parziale", variant: "warning" },
  paid: { label: "Versato", variant: "success" },
  overpaid: { label: "Versato", variant: "success" },
};

const DeadlinesCardFromViews = ({
  deadlineViews,
  onGenerateTasks,
  existingTasksCount,
  onRegisterF24,
  hasRealFiscalData,
}: {
  deadlineViews: FiscalDeadlineView[];
  onGenerateTasks?: () => void;
  existingTasksCount?: number;
  onRegisterF24?: (deadline: FiscalDeadlineView) => void;
  hasRealFiscalData?: boolean;
}) => {
  const highPriority = deadlineViews.filter((d) => d.priority === "high");
  const lowPriority = deadlineViews.filter((d) => d.priority === "low");
  const futureHigh = highPriority.filter((d) => !d.isPast);
  const totalRemaining = futureHigh.reduce(
    (sum, d) => sum + d.totalRemaining,
    0,
  );

  if (highPriority.length === 0 && lowPriority.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Scadenze fiscali
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground text-center py-6">
          Nessuna scadenza in programma
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Scadenze fiscali
          </CardTitle>
          {onGenerateTasks && (
            <GenerateButton
              onGenerate={onGenerateTasks}
              existingCount={existingTasksCount ?? 0}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {futureHigh.length > 0 && totalRemaining > 0 && (
          <div className="flex items-center justify-center gap-2 rounded-md py-2 text-sm font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            {futureHigh.length} scadenz{futureHigh.length === 1 ? "a" : "e"} ·{" "}
            {formatCurrencyPrecise(totalRemaining)} da versare
          </div>
        )}
        {highPriority.map((view) => (
          <DeadlineViewRow
            key={`${view.date}-${view.label}`}
            view={view}
            onRegisterF24={
              onRegisterF24 ? () => onRegisterF24(view) : undefined
            }
          />
        ))}
        {lowPriority.length > 0 && (
          <LowPriorityViewSection deadlines={lowPriority} />
        )}

        {hasRealFiscalData && (
          <p className="text-[10px] text-muted-foreground pt-2 border-t">
            I promemoria automatici usano ancora le stime, non le obbligazioni
            reali.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// ── Reality-aware deadline row ────────────────────────────────────

const DeadlineViewRow = ({
  view,
  onRegisterF24,
}: {
  view: FiscalDeadlineView;
  onRegisterF24?: () => void;
}) => {
  const [expanded, setExpanded] = useState(false);

  const allPaid = view.totalRemaining <= 0 && view.totalPaid > 0;
  const hasObligationItems = view.items.some((i) => i.source === "obligation");

  const urgencyVariant = allPaid
    ? ("success" as const)
    : view.isPast
      ? "secondary"
      : view.daysUntil <= 30
        ? "destructive"
        : view.daysUntil <= 90
          ? "outline"
          : "secondary";

  const countdownText = allPaid
    ? "Pagato"
    : view.isPast
      ? "Passata"
      : view.daysUntil === 0
        ? "Oggi"
        : `${view.daysUntil}g`;

  const formattedDate = formatBusinessDate(view.date, {
    day: "2-digit",
    month: "long",
  });

  return (
    <div
      className={`rounded-md border p-3 space-y-2 ${
        allPaid
          ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
          : view.isPast
            ? "opacity-50"
            : ""
      }`}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 text-sm">
          <Badge variant={urgencyVariant}>{countdownText}</Badge>
          <span className="font-medium">{formattedDate}</span>
          <span className="text-muted-foreground">
            &mdash; {view.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">
            {formatCurrencyPrecise(view.totalAmount)}
          </span>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="pl-4 space-y-1.5 text-xs text-muted-foreground border-l-2 ml-2">
          {view.items.map((item) => {
            const badgeConfig = STATUS_BADGE_CONFIG[item.status];
            return (
              <div
                key={`${item.component}-${item.competenceYear}`}
                className="flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-1.5">
                  <span>{item.component.replace(/_/g, " ")}</span>
                  <Badge
                    variant={badgeConfig.variant}
                    className="text-[9px] px-1 py-0"
                  >
                    {badgeConfig.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 tabular-nums">
                  {item.paidAmount > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {formatCurrencyPrecise(item.paidAmount)} versati
                      {item.paidDate &&
                        ` il ${formatBusinessDate(item.paidDate, { day: "2-digit", month: "short" })}`}
                    </span>
                  )}
                  {item.overpaidAmount > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">
                      +{formatCurrencyPrecise(item.overpaidAmount)} in eccesso
                    </span>
                  )}
                  <span>{formatCurrencyPrecise(item.amount)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {expanded && view.estimateComparison != null && (
        <p className="text-[10px] text-muted-foreground pl-4 ml-2">
          CRM stimava: {formatCurrencyPrecise(view.estimateComparison)}
        </p>
      )}

      {expanded && hasObligationItems && onRegisterF24 && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="h-6 gap-1 text-[10px]"
            onClick={(e) => {
              e.stopPropagation();
              onRegisterF24();
            }}
          >
            <FileText className="h-3 w-3" />
            Registra F24
          </Button>
        </div>
      )}
    </div>
  );
};

// ── Low-priority section for views ────────────────────────────────

const LowPriorityViewSection = ({
  deadlines,
}: {
  deadlines: FiscalDeadlineView[];
}) => {
  const [expanded, setExpanded] = useState(false);

  const futureCount = deadlines.filter((d) => !d.isPast).length;

  return (
    <div className="pt-1">
      <button
        type="button"
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        <span>
          Altre scadenze{futureCount > 0 ? ` (${futureCount} in arrivo)` : ""}
        </span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {deadlines.map((d) => (
            <div
              key={`${d.date}-${d.label}`}
              className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${d.isPast ? "opacity-40" : "text-muted-foreground"}`}
            >
              <span>
                {formatBusinessDate(d.date, {
                  day: "2-digit",
                  month: "short",
                })}{" "}
                &mdash; {d.label}
              </span>
              {!d.isPast && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {d.daysUntil}g
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Low-priority section (bolli, dichiarazione) ────────────────────

const LowPrioritySection = ({ deadlines }: { deadlines: FiscalDeadline[] }) => {
  const [expanded, setExpanded] = useState(false);

  const futureCount = deadlines.filter((d) => !d.isPast).length;

  return (
    <div className="pt-1">
      <button
        type="button"
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        <span>
          Altre scadenze{futureCount > 0 ? ` (${futureCount} in arrivo)` : ""}
        </span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {deadlines.map((d) => (
            <div
              key={buildFiscalDeadlineKey(d)}
              className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${d.isPast ? "opacity-40" : "text-muted-foreground"}`}
            >
              <span>
                {formatBusinessDate(d.date, {
                  day: "2-digit",
                  month: "short",
                })}{" "}
                &mdash; {d.label}
              </span>
              {!d.isPast && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {d.daysUntil}g
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Generate tasks button with confirmation ────────────────────────

const GenerateButton = ({
  onGenerate,
  existingCount,
}: {
  onGenerate: () => void;
  existingCount: number;
}) => {
  if (existingCount === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={onGenerate}
      >
        <ListChecks className="h-3.5 w-3.5" />
        Genera promemoria
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <ListChecks className="h-3.5 w-3.5" />
          Rigenera promemoria
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rigenerare le scadenze fiscali?</AlertDialogTitle>
          <AlertDialogDescription>
            Esistono gi&agrave; {existingCount} promemoria fiscali per
            quest&apos;anno. La rigenerazione li sostituir&agrave; con le
            scadenze calcolate aggiornate.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction onClick={onGenerate}>Rigenera</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
