import { useState, useMemo } from "react";
import { useDataProvider } from "ra-core";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

import { useIsMobile } from "@/hooks/use-mobile";
import { todayISODate } from "@/lib/dateTimezone";
import { formatBusinessDate } from "@/lib/dateTimezone";

import type { CrmDataProvider } from "../providers/types";
import type { FiscalDeadlineView } from "./fiscalRealityTypes";
import { formatCurrencyPrecise } from "./dashboardModel";

// ── Component label lookup ──────────────────────────────────────────────────

const COMPONENT_LABELS: Record<string, string> = {
  imposta_saldo: "Saldo Imposta Sostitutiva",
  imposta_acconto_1: "1° Acconto Imposta Sostitutiva",
  imposta_acconto_2: "2° Acconto Imposta Sostitutiva",
  imposta_acconto_unico: "Acconto Unico Imposta Sostitutiva",
  inps_saldo: "Saldo INPS Gestione Separata",
  inps_acconto_1: "1° Acconto INPS",
  inps_acconto_2: "2° Acconto INPS",
  bollo: "Imposta di Bollo",
};

// ── Types ────────────────────────────────────────────────────────────────────

type F24RegistrationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deadlineView: FiscalDeadlineView | null;
};

type LineState = {
  obligationId: string;
  component: string;
  amount: string;
  checked: boolean;
};

// ── Component ────────────────────────────────────────────────────────────────

export const F24RegistrationDialog = ({
  open,
  onOpenChange,
  deadlineView,
}: F24RegistrationDialogProps) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Build initial line state from deadline items that come from obligations
  const initialLines = useMemo<LineState[]>(() => {
    if (!deadlineView) return [];

    // Only include items that have an obligation source (not pure estimates)
    // The view items don't carry obligation_id directly, so we need to match
    // We use the component + competenceYear as the key — but we need the
    // actual obligation IDs. Since the view layer merges them, we pass the
    // remaining amount as the suggested payment.
    return deadlineView.items
      .filter((item) => item.source === "obligation" && item.remainingAmount > 0)
      .map((item) => ({
        // We don't have obligation_id in the view item, so we'll need to resolve
        // it. For now we store the component key — obligation lookup happens at submit.
        obligationId: `${item.component}:${item.competenceYear}`,
        component: item.component,
        amount: String(item.remainingAmount),
        checked: true,
      }));
  }, [deadlineView]);

  const [lines, setLines] = useState<LineState[]>(initialLines);
  const [submissionDate, setSubmissionDate] = useState(todayISODate());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset when dialog opens with new deadline
  const [lastDeadlineKey, setLastDeadlineKey] = useState<string | null>(null);
  const currentKey = deadlineView
    ? `${deadlineView.date}-${deadlineView.label}`
    : null;

  if (currentKey !== lastDeadlineKey && open) {
    setLastDeadlineKey(currentKey);
    setLines(initialLines);
    setSubmissionDate(todayISODate());
    setNotes("");
    setError(null);
  }

  const updateLine = (index: number, updates: Partial<LineState>) => {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...updates } : line)),
    );
  };

  const checkedLines = lines.filter((l) => l.checked);
  const allAmountsValid = checkedLines.every((l) => {
    const n = Number(l.amount);
    return l.amount !== "" && !isNaN(n) && n >= 0;
  });
  const isValid =
    checkedLines.length > 0 && allAmountsValid && submissionDate !== "";

  const handleSubmit = async () => {
    if (!isValid || !deadlineView) return;
    setSaving(true);
    setError(null);

    try {
      // Resolve obligation IDs: fetch obligations for the payment year
      // and match by component + competence_year
      const obligations = await dataProvider.getFiscalObligations(
        deadlineView.paymentYear,
      );

      const resolvedLines = checkedLines
        .map((line) => {
          const [component, yearStr] = line.obligationId.split(":");
          const competenceYear = Number(yearStr);
          const obligation = obligations.find(
            (o) =>
              o.component === component &&
              o.competence_year === competenceYear &&
              o.due_date === deadlineView.date,
          );
          if (!obligation) return null;
          return {
            obligation_id: obligation.id,
            amount: Number(line.amount),
          };
        })
        .filter(
          (l): l is { obligation_id: string; amount: number } => l != null,
        );

      if (resolvedLines.length === 0) {
        setError(
          "Nessuna obbligazione trovata per le voci selezionate. Verifica che le obbligazioni esistano.",
        );
        setSaving(false);
        return;
      }

      await dataProvider.registerF24({
        submissionDate,
        notes: notes.trim() || null,
        lines: resolvedLines,
      });

      // Invalidate fiscal queries
      queryClient.invalidateQueries({ queryKey: ["fiscal-obligations"] });
      queryClient.invalidateQueries({
        queryKey: ["fiscal-enriched-payment-lines"],
      });

      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Errore nella registrazione F24",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!deadlineView) return null;

  const formattedDate = formatBusinessDate(deadlineView.date, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const formBody = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="f24-date">Data versamento</Label>
        <Input
          id="f24-date"
          type="date"
          value={submissionDate}
          onChange={(e) => setSubmissionDate(e.target.value)}
        />
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nessuna obbligazione aperta per questa scadenza.
        </p>
      ) : (
        <div className="space-y-3">
          <Label>Voci da versare</Label>
          {lines.map((line, index) => (
            <div
              key={line.obligationId}
              className="flex items-center gap-3 rounded-md border p-3"
            >
              <Checkbox
                checked={line.checked}
                onCheckedChange={(checked) =>
                  updateLine(index, { checked: checked === true })
                }
              />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">
                  {COMPONENT_LABELS[line.component] ?? line.component}
                </p>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={line.amount}
                  onChange={(e) =>
                    updateLine(index, { amount: e.target.value })
                  }
                  className="h-8 text-sm"
                  disabled={!line.checked}
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                residuo{" "}
                {formatCurrencyPrecise(
                  deadlineView.items.find(
                    (i) =>
                      `${i.component}:${i.competenceYear}` ===
                      line.obligationId,
                  )?.remainingAmount ?? 0,
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="f24-notes">Note</Label>
        <Textarea
          id="f24-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Note opzionali"
          rows={2}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );

  const footerButtons = (
    <>
      <Button
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={saving}
      >
        Annulla
      </Button>
      <Button onClick={handleSubmit} disabled={!isValid || saving}>
        {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Registra F24
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Registra F24 — {formattedDate}</SheetTitle>
          </SheetHeader>
          <div className="py-4">{formBody}</div>
          <SheetFooter className="flex-row gap-2 pt-2">
            {footerButtons}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-130">
        <DialogHeader>
          <DialogTitle>Registra F24 — {formattedDate}</DialogTitle>
        </DialogHeader>
        {formBody}
        <DialogFooter>{footerButtons}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
