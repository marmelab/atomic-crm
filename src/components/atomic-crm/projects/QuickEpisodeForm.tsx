import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TravelRouteCalculatorDialog } from "../travel/TravelRouteCalculatorDialog";
import type { Expense } from "../types";

export interface FeeDefaults {
  fee_shooting: number;
  fee_editing: number;
  fee_other: number;
  service_type: string;
  km_rate: number;
}

export interface EpisodeFormDefaults extends FeeDefaults {
  service_date: string;
  km_distance: number;
  location: string;
  notes: string;
}

/** Pre-fill fees based on tv_show type */
export const getDefaultFees = (
  tvShow?: string | null,
  defaultKmRate = 0.19,
): FeeDefaults => {
  switch (tvShow) {
    case "gustare_sicilia":
      return {
        fee_shooting: 233,
        fee_editing: 311,
        fee_other: 0,
        service_type: "riprese_montaggio",
        km_rate: defaultKmRate,
      };
    case "bella_tra_i_fornelli":
    case "vale_il_viaggio":
      return {
        fee_shooting: 233,
        fee_editing: 156,
        fee_other: 0,
        service_type: "riprese_montaggio",
        km_rate: defaultKmRate,
      };
    default:
      return {
        fee_shooting: 0,
        fee_editing: 0,
        fee_other: 0,
        service_type: "riprese_montaggio",
        km_rate: defaultKmRate,
      };
  }
};

export interface EpisodeFormData {
  service_date: string;
  service_type: string;
  fee_shooting: number;
  fee_editing: number;
  fee_other: number;
  km_distance: number;
  km_rate: number;
  location: string;
  notes: string;
  extra_expenses: EpisodeExtraExpenseFormData[];
}

export interface EpisodeExtraExpenseFormData {
  expense_type: Expense["expense_type"];
  amount: number;
  markup_percent: number;
  description: string;
}

const createExtraExpense = (
  overrides?: Partial<EpisodeExtraExpenseFormData>,
): EpisodeExtraExpenseFormData => ({
  expense_type: "altro",
  amount: 0,
  markup_percent: 0,
  description: "",
  ...overrides,
});

interface Props {
  defaults: EpisodeFormDefaults;
  defaultTravelOrigin?: string;
  saving: boolean;
  onSubmit: (data: EpisodeFormData) => void;
  onCancel: () => void;
}

export const QuickEpisodeForm = ({
  defaults,
  defaultTravelOrigin,
  saving,
  onSubmit,
  onCancel,
}: Props) => {
  const [serviceDate, setServiceDate] = useState(defaults.service_date);
  const [feeShooting, setFeeShooting] = useState(defaults.fee_shooting);
  const [feeEditing, setFeeEditing] = useState(defaults.fee_editing);
  const [feeOther, setFeeOther] = useState(defaults.fee_other);
  const [kmDistance, setKmDistance] = useState(defaults.km_distance);
  const [kmRate, setKmRate] = useState(defaults.km_rate);
  const [location, setLocation] = useState(defaults.location);
  const [notes, setNotes] = useState(defaults.notes);
  const [extraExpenses, setExtraExpenses] = useState<
    EpisodeExtraExpenseFormData[]
  >([]);

  const totalFees = feeShooting + feeEditing + feeOther;
  const kmCost = kmDistance * kmRate;
  const extraExpensesTotal = extraExpenses.reduce(
    (sum, expense) =>
      sum + Number(expense.amount) * (1 + Number(expense.markup_percent) / 100),
    0,
  );
  const grandTotal = totalFees + kmCost + extraExpensesTotal;

  const addExtraExpense = (
    overrides?: Partial<EpisodeExtraExpenseFormData>,
  ) => {
    setExtraExpenses((currentExpenses) => [
      ...currentExpenses,
      createExtraExpense(overrides),
    ]);
  };

  const updateExtraExpense = (
    index: number,
    patch: Partial<EpisodeExtraExpenseFormData>,
  ) => {
    setExtraExpenses((currentExpenses) =>
      currentExpenses.map((expense, expenseIndex) =>
        expenseIndex === index ? { ...expense, ...patch } : expense,
      ),
    );
  };

  const removeExtraExpense = (index: number) => {
    setExtraExpenses((currentExpenses) =>
      currentExpenses.filter((_, expenseIndex) => expenseIndex !== index),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceDate) return;
    onSubmit({
      service_date: serviceDate,
      service_type: defaults.service_type,
      fee_shooting: feeShooting,
      fee_editing: feeEditing,
      fee_other: feeOther,
      km_distance: kmDistance,
      km_rate: kmRate,
      location,
      notes,
      extra_expenses: extraExpenses,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="ep-date">Data *</Label>
          <Input
            id="ep-date"
            type="date"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="ep-shooting">Riprese (EUR)</Label>
          <Input
            id="ep-shooting"
            type="number"
            step="0.01"
            value={feeShooting}
            onChange={(e) => setFeeShooting(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="ep-editing">Montaggio (EUR)</Label>
          <Input
            id="ep-editing"
            type="number"
            step="0.01"
            value={feeEditing}
            onChange={(e) => setFeeEditing(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="ep-other">Altro (EUR)</Label>
          <Input
            id="ep-other"
            type="number"
            step="0.01"
            value={feeOther}
            onChange={(e) => setFeeOther(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="ep-km">Km</Label>
          <Input
            id="ep-km"
            type="number"
            step="1"
            value={kmDistance}
            onChange={(e) => setKmDistance(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="ep-km-rate">Tariffa km (EUR)</Label>
          <Input
            id="ep-km-rate"
            type="number"
            step="0.01"
            min="0"
            value={kmRate}
            onChange={(e) => setKmRate(Number(e.target.value))}
          />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <TravelRouteCalculatorDialog
            defaultKmRate={defaults.km_rate}
            defaultTravelOrigin={defaultTravelOrigin}
            currentKmRate={kmRate}
            initialDestination={location}
            onApply={(estimate) => {
              setKmDistance(estimate.totalDistanceKm);
              setKmRate(estimate.kmRate ?? defaults.km_rate);
              if (!location.trim()) {
                setLocation(estimate.generatedLocation);
              }
            }}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="ep-location">Località</Label>
          <Input
            id="ep-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="es. Catania"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="ep-notes">Note</Label>
          <Input
            id="ep-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="sm:col-span-2 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <Label>Spese extra</Label>
              <p className="text-xs text-muted-foreground">
                Per casello, pranzo o altre uscite usa una voce extra nello
                stesso salvataggio.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  addExtraExpense({
                    expense_type: "altro",
                    description: "Casello autostradale",
                  })
                }
              >
                Casello
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  addExtraExpense({
                    expense_type: "altro",
                    description: "Pranzo",
                  })
                }
              >
                Pranzo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addExtraExpense()}
              >
                Altra spesa
              </Button>
            </div>
          </div>

          {extraExpenses.length === 0 ? (
            <div className="rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground">
              Nessuna spesa extra aggiunta.
            </div>
          ) : null}

          {extraExpenses.map((expense, index) => (
            <div
              key={`${expense.description}-${index}`}
              className="grid grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2"
            >
              <div>
                <Label htmlFor={`ep-extra-type-${index}`}>Tipo spesa</Label>
                <select
                  id={`ep-extra-type-${index}`}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={expense.expense_type}
                  onChange={(event) =>
                    updateExtraExpense(index, {
                      expense_type: event.target
                        .value as EpisodeExtraExpenseFormData["expense_type"],
                    })
                  }
                >
                  <option value="acquisto_materiale">Acquisto materiale</option>
                  <option value="abbonamento_software">Abbonamento software</option>
                  <option value="noleggio">Noleggio</option>
                  <option value="pedaggio_autostradale">Pedaggio autostradale</option>
                  <option value="vitto_alloggio">Vitto e alloggio</option>
                  <option value="altro">Altro</option>
                </select>
              </div>
              <div>
                <Label htmlFor={`ep-extra-amount-${index}`}>
                  Importo (EUR)
                </Label>
                <Input
                  id={`ep-extra-amount-${index}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={expense.amount}
                  onChange={(event) =>
                    updateExtraExpense(index, {
                      amount: Number(event.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor={`ep-extra-markup-${index}`}>Ricarico %</Label>
                <Input
                  id={`ep-extra-markup-${index}`}
                  type="number"
                  step="0.01"
                  min="0"
                  value={expense.markup_percent}
                  onChange={(event) =>
                    updateExtraExpense(index, {
                      markup_percent: Number(event.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label htmlFor={`ep-extra-description-${index}`}>
                  Descrizione
                </Label>
                <Input
                  id={`ep-extra-description-${index}`}
                  value={expense.description}
                  onChange={(event) =>
                    updateExtraExpense(index, {
                      description: event.target.value,
                    })
                  }
                  placeholder="es. Casello autostradale, pranzo troupe"
                />
              </div>
              <div className="sm:col-span-2 flex justify-between gap-2">
                <div className="text-sm text-muted-foreground">
                  Totale spesa: EUR{" "}
                  {(
                    Number(expense.amount) *
                    (1 + Number(expense.markup_percent) / 100)
                  ).toFixed(2)}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeExtraExpense(index)}
                >
                  Rimuovi
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg bg-muted p-3 text-sm">
        <div className="flex justify-between">
          <span>Compensi</span>
          <span className="font-medium">€{totalFees.toFixed(2)}</span>
        </div>
        {kmDistance > 0 && (
          <div className="flex justify-between">
            <span>
              Km ({kmDistance} × €{kmRate})
            </span>
            <span className="font-medium">€{kmCost.toFixed(2)}</span>
          </div>
        )}
        {extraExpensesTotal > 0 && (
          <div className="flex justify-between">
            <span>Spese extra</span>
            <span className="font-medium">
              €{extraExpensesTotal.toFixed(2)}
            </span>
          </div>
        )}
        <Separator className="my-1" />
        <div className="flex justify-between font-bold">
          <span>Totale</span>
          <span>€{grandTotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Annulla
        </Button>
        <Button type="submit" disabled={saving || !serviceDate}>
          {saving ? "Salvataggio..." : "Registra"}
        </Button>
      </div>
    </form>
  );
};
