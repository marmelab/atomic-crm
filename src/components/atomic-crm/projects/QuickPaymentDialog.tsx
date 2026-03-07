import { useEffect, useState } from "react";
import { useCreate, useGetOne, useNotify, useRefresh } from "ra-core";
import { useLocation } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Euro } from "lucide-react";
import type { Project } from "../types";
import {
  getProjectQuickPaymentDraftContextFromSearch,
  getUnifiedAiHandoffContextFromSearch,
} from "../payments/paymentLinking";

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

const round2 = (n: number) => Math.round(n * 100) / 100;

const getSuggestedAmount = (
  type: string,
  totals: { fees: number; expenses: number; paid: number },
) => {
  const balance = totals.fees + totals.expenses - totals.paid;
  switch (type) {
    case "rimborso_spese":
      return round2(totals.expenses);
    case "acconto":
      return round2(totals.fees);
    case "saldo":
      return round2(Math.max(balance, 0));
    default:
      return round2(Math.max(balance, 0));
  }
};

const getAmountHint = (type: string): string => {
  switch (type) {
    case "rimborso_spese":
      return "= totale spese progetto (km, materiale, noleggio...)";
    case "acconto":
      return "= compensi professionali";
    case "saldo":
      return "= residuo da incassare";
    default:
      return "";
  }
};

export const QuickPaymentDialog = ({ record }: { record: Project }) => {
  const [open, setOpen] = useState(false);
  const [lastAutoOpenedSearch, setLastAutoOpenedSearch] = useState<
    string | null
  >(null);
  const [create] = useCreate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [saving, setSaving] = useState(false);
  const location = useLocation();
  const launcherHandoff = getUnifiedAiHandoffContextFromSearch(location.search);
  const draftContext = getProjectQuickPaymentDraftContextFromSearch(
    location.search,
  );

  const { data: financials } = useGetOne("project_financials", {
    id: record.id,
  });

  const totalFees = toNum(financials?.total_fees);
  const totalExpenses = toNum(financials?.total_expenses);
  const totalPaid = toNum(financials?.total_paid);
  const grandTotal = totalFees + totalExpenses;
  const balanceDue = grandTotal - totalPaid;

  const totals = { fees: totalFees, expenses: totalExpenses, paid: totalPaid };

  const getInitialPaymentType = () =>
    draftContext?.paymentType ?? launcherHandoff?.paymentType ?? "acconto";

  const [amount, setAmount] = useState(0);
  const [paymentType, setPaymentType] = useState("acconto");
  const [paymentDate, setPaymentDate] = useState("");
  const [status, setStatus] = useState("ricevuto");
  const [method, setMethod] = useState("bonifico");
  const [notes, setNotes] = useState("");

  const handleTypeChange = (newType: string) => {
    setPaymentType(newType);
    setAmount(getSuggestedAmount(newType, totals));
  };

  const handleOpenChange = (v: boolean) => {
    if (v) {
      const nextPaymentType = getInitialPaymentType();
      setPaymentType(nextPaymentType);
      setPaymentDate("");
      setStatus(draftContext?.status ?? "ricevuto");
      setMethod("bonifico");
      setNotes("");
      setAmount(
        draftContext?.amount ?? getSuggestedAmount(nextPaymentType, totals),
      );
    }
    setOpen(v);
  };

  useEffect(() => {
    if (
      financials &&
      !open &&
      launcherHandoff?.action === "project_quick_payment" &&
      launcherHandoff.openDialog === "quick_payment" &&
      lastAutoOpenedSearch !== location.search
    ) {
      handleOpenChange(true);
      setLastAutoOpenedSearch(location.search);
    }
  }, [
    financials,
    lastAutoOpenedSearch,
    launcherHandoff,
    location.search,
    open,
    totalFees,
    totalExpenses,
    totalPaid,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;
    setSaving(true);
    try {
      await create(
        "payments",
        {
          data: {
            client_id: record.client_id,
            project_id: record.id,
            payment_type: paymentType,
            amount,
            status,
            method: method || null,
            payment_date: paymentDate || null,
            notes: notes || null,
          },
        },
        { returnPromise: true },
      );
      notify("Pagamento registrato", { type: "success" });
      refresh();
      setOpen(false);
    } catch {
      notify("Errore durante la registrazione", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const hint = getAmountHint(paymentType);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Euro className="size-4 mr-1" />
          Pagamento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader className="pr-6">
          <DialogTitle>Registra Pagamento — {record.name}</DialogTitle>
        </DialogHeader>

        {launcherHandoff?.action === "project_quick_payment" ? (
          <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {draftContext
              ? "Apertura guidata dalla chat AI unificata con una bozza quick payment modificabile. Importo, tipo e stato arrivano gia precompilati, ma il dialog resta manuale: controlla i dati prima di confermare."
              : "Apertura guidata dalla chat AI unificata. Il dialog resta manuale: controlla i dati prima di confermare."}
          </div>
        ) : null}

        <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span>Compensi</span>
            <span>{eur(totalFees)}</span>
          </div>
          {totalExpenses > 0 && (
            <div className="flex justify-between">
              <span>Spese</span>
              <span>{eur(totalExpenses)}</span>
            </div>
          )}
          <Separator className="my-1" />
          <div className="flex justify-between font-medium">
            <span>Totale</span>
            <span>{eur(grandTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Già pagato</span>
            <span className="text-green-600">{eur(totalPaid)}</span>
          </div>
          <Separator className="my-1" />
          <div className="flex justify-between font-bold">
            <span>Da incassare</span>
            <span
              className={balanceDue > 0 ? "text-orange-600" : "text-green-600"}
            >
              {eur(balanceDue)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pay-type">Tipo</Label>
              <select
                id="pay-type"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={paymentType}
                onChange={(e) => handleTypeChange(e.target.value)}
              >
                <option value="acconto">Acconto</option>
                <option value="saldo">Saldo</option>
                <option value="rimborso_spese">Rimborso spese</option>
              </select>
            </div>
            <div>
              <Label htmlFor="pay-amount">Importo (EUR) *</Label>
              <Input
                id="pay-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
              />
              {hint && (
                <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
              )}
            </div>
            <div>
              <Label htmlFor="pay-date">Data pagamento</Label>
              <Input
                id="pay-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pay-status">Stato</Label>
              <select
                id="pay-status"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="ricevuto">Ricevuto</option>
                <option value="in_attesa">In attesa</option>
              </select>
            </div>
            <div>
              <Label htmlFor="pay-method">Metodo</Label>
              <select
                id="pay-method"
                aria-label="Metodo di pagamento"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="bonifico">Bonifico</option>
                <option value="contanti">Contanti</option>
                <option value="paypal">PayPal</option>
                <option value="altro">Altro</option>
              </select>
            </div>
            <div>
              <Label htmlFor="pay-notes">Note</Label>
              <Input
                id="pay-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={saving || amount <= 0}>
              {saving ? "Salvataggio..." : "Registra"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
