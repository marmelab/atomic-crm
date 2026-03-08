import { useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
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

import { formatCurrencyPrecise } from "./dashboardModel";
import type { FiscalDeadline } from "./fiscalModel";
import type { FiscalPaymentRecord } from "./useFiscalPaymentTracking";

export const DashboardDeadlinesCard = ({
  deadlines,
  isFirstYear,
  onGenerateTasks,
  existingTasksCount,
  getPayment,
  onMarkPaid,
  onClearPayment,
}: {
  deadlines: FiscalDeadline[];
  isFirstYear: boolean;
  onGenerateTasks?: () => void;
  existingTasksCount?: number;
  getPayment?: (deadline: FiscalDeadline) => FiscalPaymentRecord | null;
  onMarkPaid?: (deadline: FiscalDeadline) => void;
  onClearPayment?: (deadline: FiscalDeadline) => void;
}) => {
  if (isFirstYear) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Scadenze fiscali stimate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">
              Primo anno di attivit&agrave;
            </p>
            <p>
              Nessun acconto dovuto quest&apos;anno. Accantonare circa il 30% del
              fatturato per il saldo di giugno del prossimo anno.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const highPriority = deadlines.filter((d) => d.priority === "high");
  const lowPriority = deadlines.filter((d) => d.priority === "low");

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
        {highPriority.map((deadline) => (
          <DeadlineRow
            key={deadline.date + deadline.label}
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

  const formattedDate = new Date(
    deadline.date + "T00:00:00",
  ).toLocaleDateString("it-IT", {
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
          <span className="text-muted-foreground">&mdash; {deadline.label}</span>
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
                {new Date(payment.paidDate + "T00:00:00").toLocaleDateString(
                  "it-IT",
                  { day: "2-digit", month: "short" },
                )}
              </Badge>
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
                Segna come pagato
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
};

// ── Low-priority section (bolli, dichiarazione) ────────────────────

const LowPrioritySection = ({
  deadlines,
}: {
  deadlines: FiscalDeadline[];
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
              key={d.date + d.label}
              className={`flex items-center justify-between text-xs px-2 py-1.5 rounded ${d.isPast ? "opacity-40" : "text-muted-foreground"}`}
            >
              <span>
                {new Date(d.date + "T00:00:00").toLocaleDateString("it-IT", {
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
