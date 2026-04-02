import { useState } from "react";
import { useDataProvider } from "ra-core";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { FiscalDeadlineComponent } from "./fiscalModelTypes";
import type { ObligationDraft } from "./buildObligationsFromDeclaration";

// ── Component labels ────────────────────────────────────────────────────────

const COMPONENT_OPTIONS: Array<{
  value: FiscalDeadlineComponent;
  label: string;
}> = [
  { value: "imposta_saldo", label: "Saldo Imposta Sostitutiva" },
  { value: "imposta_acconto_1", label: "1° Acconto Imposta Sostitutiva" },
  { value: "imposta_acconto_2", label: "2° Acconto Imposta Sostitutiva" },
  {
    value: "imposta_acconto_unico",
    label: "Acconto Unico Imposta Sostitutiva",
  },
  { value: "inps_saldo", label: "Saldo INPS Gestione Separata" },
  { value: "inps_acconto_1", label: "1° Acconto INPS" },
  { value: "inps_acconto_2", label: "2° Acconto INPS" },
  { value: "bollo", label: "Imposta di Bollo" },
];

// ── Types ────────────────────────────────────────────────────────────────────

type ObligationEntryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Default competence year (typically selectedYear) */
  defaultCompetenceYear: number;
  /** Default payment year (typically selectedYear) */
  defaultPaymentYear: number;
};

// ── Component ────────────────────────────────────────────────────────────────

export const ObligationEntryDialog = ({
  open,
  onOpenChange,
  defaultCompetenceYear,
  defaultPaymentYear,
}: ObligationEntryDialogProps) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [component, setComponent] = useState<FiscalDeadlineComponent | "">("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [competenceYear, setCompetenceYear] = useState(
    String(defaultCompetenceYear),
  );
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setComponent("");
    setAmount("");
    setDueDate("");
    setCompetenceYear(String(defaultCompetenceYear));
    setNotes("");
    setError(null);
  }
  if (!open && wasOpen) {
    setWasOpen(false);
  }

  const numAmount = amount === "" ? null : Number(amount);
  const numYear =
    competenceYear === "" ? null : Number(competenceYear);

  const isValid =
    component !== "" &&
    numAmount != null &&
    numAmount >= 0 &&
    dueDate !== "" &&
    numYear != null &&
    !isNaN(numYear);

  const handleSubmit = async () => {
    if (!isValid || component === "" || numAmount == null || numYear == null)
      return;
    setSaving(true);
    setError(null);

    try {
      const draft: ObligationDraft = {
        declaration_id: null,
        source: "manual",
        component: component as FiscalDeadlineComponent,
        competence_year: numYear,
        payment_year: defaultPaymentYear,
        due_date: dueDate,
        amount: numAmount,
        installment_number: null,
        installment_total: null,
        is_overridden: false,
        overridden_at: null,
        notes: notes.trim() || null,
      };

      await dataProvider.createFiscalObligation(draft);

      // Invalidate fiscal queries
      queryClient.invalidateQueries({ queryKey: ["fiscal-obligations"] });
      queryClient.invalidateQueries({
        queryKey: ["fiscal-enriched-payment-lines"],
      });

      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Errore nel salvataggio",
      );
    } finally {
      setSaving(false);
    }
  };

  const formBody = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="obl-component">Componente</Label>
        <Select
          value={component}
          onValueChange={(v) => setComponent(v as FiscalDeadlineComponent)}
        >
          <SelectTrigger id="obl-component">
            <SelectValue placeholder="Seleziona componente" />
          </SelectTrigger>
          <SelectContent>
            {COMPONENT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="obl-amount">Importo (€)</Label>
        <Input
          id="obl-amount"
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="obl-due-date">Data scadenza</Label>
        <Input
          id="obl-due-date"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="obl-year">Anno competenza</Label>
        <Input
          id="obl-year"
          type="number"
          value={competenceYear}
          onChange={(e) => setCompetenceYear(e.target.value)}
          min={2020}
          max={2100}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="obl-notes">Note</Label>
        <Textarea
          id="obl-notes"
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
        Salva obbligazione
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Aggiungi obbligazione manuale</SheetTitle>
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
      <DialogContent className="sm:max-w-105">
        <DialogHeader>
          <DialogTitle>Aggiungi obbligazione manuale</DialogTitle>
        </DialogHeader>
        {formBody}
        <DialogFooter>{footerButtons}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
