import { useState, useEffect } from "react";
import { useDataProvider } from "ra-core";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import type { CrmDataProvider } from "../providers/types";
import { formatCurrencyPrecise } from "./dashboardModel";

// ── Types ────────────────────────────────────────────────────────────────────

type DichiarazioneEntryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The tax year to enter/edit (typically selectedYear - 1) */
  taxYear: number;
  /** CRM-estimated substitute tax for divergence warning */
  estimatedSubstituteTax?: number;
  /** CRM-estimated INPS for divergence warning */
  estimatedInps?: number;
};

// ── Component ────────────────────────────────────────────────────────────────

export const DichiarazioneEntryDialog = ({
  open,
  onOpenChange,
  taxYear,
  estimatedSubstituteTax,
  estimatedInps,
}: DichiarazioneEntryDialogProps) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();

  // Load existing declaration for this tax year
  const { data: existing, isPending: loadingExisting } = useQuery({
    queryKey: ["fiscal-declaration", taxYear],
    queryFn: () => dataProvider.getFiscalDeclaration(taxYear),
    enabled: open,
  });

  // Form state
  const [totalSubstituteTax, setTotalSubstituteTax] = useState("");
  const [totalInps, setTotalInps] = useState("");
  const [priorAdvancesTax, setPriorAdvancesTax] = useState("");
  const [priorAdvancesInps, setPriorAdvancesInps] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedCount, setBlockedCount] = useState(0);

  // Pre-fill form when existing declaration loads
  useEffect(() => {
    if (existing) {
      setTotalSubstituteTax(String(existing.total_substitute_tax));
      setTotalInps(String(existing.total_inps));
      setPriorAdvancesTax(String(existing.prior_advances_substitute_tax));
      setPriorAdvancesInps(String(existing.prior_advances_inps));
      setNotes(existing.notes ?? "");
    } else {
      setTotalSubstituteTax("");
      setTotalInps("");
      setPriorAdvancesTax("");
      setPriorAdvancesInps("");
      setNotes("");
    }
    setBlockedCount(0);
    setError(null);
  }, [existing, open]);

  const isEdit = existing != null;
  const isMobile = useIsMobile();

  // Validation
  const numTax = totalSubstituteTax === "" ? null : Number(totalSubstituteTax);
  const numInps = totalInps === "" ? null : Number(totalInps);
  const numPriorTax = priorAdvancesTax === "" ? 0 : Number(priorAdvancesTax);
  const numPriorInps = priorAdvancesInps === "" ? 0 : Number(priorAdvancesInps);

  const isValid =
    numTax != null &&
    numTax >= 0 &&
    numInps != null &&
    numInps >= 0 &&
    numPriorTax >= 0 &&
    numPriorInps >= 0;

  // Divergence warnings (>30% from CRM estimate)
  const taxDivergence =
    numTax != null && estimatedSubstituteTax != null && estimatedSubstituteTax > 0
      ? Math.abs(numTax - estimatedSubstituteTax) / estimatedSubstituteTax
      : null;

  const inpsDivergence =
    numInps != null && estimatedInps != null && estimatedInps > 0
      ? Math.abs(numInps - estimatedInps) / estimatedInps
      : null;

  const showTaxWarning = taxDivergence != null && taxDivergence > 0.3;
  const showInpsWarning = inpsDivergence != null && inpsDivergence > 0.3;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSaving(true);
    setError(null);
    setBlockedCount(0);

    try {
      const declaration = await dataProvider.saveFiscalDeclaration({
        ...(existing?.id ? { id: existing.id } : {}),
        tax_year: taxYear,
        total_substitute_tax: numTax!,
        total_inps: numInps!,
        prior_advances_substitute_tax: numPriorTax,
        prior_advances_inps: numPriorInps,
        notes: notes.trim() || null,
      });

      // Regenerate obligations from the saved declaration
      const result = await dataProvider.regenerateDeclarationObligations(
        declaration.id,
      );

      // Invalidate fiscal queries
      queryClient.invalidateQueries({ queryKey: ["fiscal-obligations"] });
      queryClient.invalidateQueries({
        queryKey: ["fiscal-enriched-payment-lines"],
      });
      queryClient.invalidateQueries({ queryKey: ["fiscal-declaration"] });

      if (result.blockedObligations.length > 0) {
        setBlockedCount(result.blockedObligations.length);
        // Keep dialog open to show warning
      } else {
        onOpenChange(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const title = `${isEdit ? "Modifica" : "Inserisci"} dichiarazione ${taxYear}`;

  const formBody = loadingExisting ? (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  ) : (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="decl-tax">Imposta sostitutiva totale (€)</Label>
        <Input
          id="decl-tax"
          type="number"
          min={0}
          step="0.01"
          value={totalSubstituteTax}
          onChange={(e) => setTotalSubstituteTax(e.target.value)}
          placeholder="0.00"
        />
        {showTaxWarning && (
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Diverge &gt;30% dalla stima CRM (
            {formatCurrencyPrecise(estimatedSubstituteTax!)})
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="decl-inps">INPS totale (€)</Label>
        <Input
          id="decl-inps"
          type="number"
          min={0}
          step="0.01"
          value={totalInps}
          onChange={(e) => setTotalInps(e.target.value)}
          placeholder="0.00"
        />
        {showInpsWarning && (
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Diverge &gt;30% dalla stima CRM (
            {formatCurrencyPrecise(estimatedInps!)})
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="decl-prior-tax">
          Acconti imposta già versati (€)
        </Label>
        <Input
          id="decl-prior-tax"
          type="number"
          min={0}
          step="0.01"
          value={priorAdvancesTax}
          onChange={(e) => setPriorAdvancesTax(e.target.value)}
          placeholder="0.00"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="decl-prior-inps">
          Acconti INPS già versati (€)
        </Label>
        <Input
          id="decl-prior-inps"
          type="number"
          min={0}
          step="0.01"
          value={priorAdvancesInps}
          onChange={(e) => setPriorAdvancesInps(e.target.value)}
          placeholder="0.00"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="decl-notes">Note</Label>
        <Textarea
          id="decl-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Note opzionali"
          rows={2}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {blockedCount > 0 && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-medium">
            Dichiarazione salvata, ma {blockedCount} obbligazione
            {blockedCount > 1 ? "i" : ""} non{" "}
            {blockedCount > 1 ? "sono state" : "è stata"} rigenerat
            {blockedCount > 1 ? "e" : "a"} (già versate o modificate
            manualmente).
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => onOpenChange(false)}
          >
            Chiudi
          </Button>
        </div>
      )}
    </div>
  );

  const footerButtons = !loadingExisting && blockedCount === 0 ? (
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
        {isEdit ? "Aggiorna" : "Salva"} e genera obbligazioni
      </Button>
    </>
  ) : null;

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="py-4">{formBody}</div>
          {footerButtons && (
            <SheetFooter className="flex-row gap-2 pt-2">
              {footerButtons}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-120">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {formBody}
        {footerButtons && <DialogFooter>{footerButtons}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
};
