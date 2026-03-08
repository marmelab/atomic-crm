import type { LucideIcon } from "lucide-react";
import {
  Car,
  ShoppingCart,
  ArrowLeftRight,
  Receipt,
  Utensils,
  Route,
  MonitorSmartphone,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";

import type { Expense } from "../types";
import { calculateKmReimbursement } from "@/lib/semantics/crmSemanticRegistry";

export const eur = (n: number) =>
  n ? n.toLocaleString("it-IT", { minimumFractionDigits: 2 }) : "--";

export const expenseTypeIcons: Record<string, LucideIcon> = {
  spostamento_km: Car,
  pedaggio_autostradale: Route,
  vitto_alloggio: Utensils,
  acquisto_materiale: ShoppingCart,
  abbonamento_software: MonitorSmartphone,
  noleggio: Package,
  credito_ricevuto: ArrowLeftRight,
  altro: Receipt,
};

export const expenseTypeColors: Record<string, string> = {
  spostamento_km: "text-amber-600 bg-amber-50 border-amber-200",
  pedaggio_autostradale: "text-orange-600 bg-orange-50 border-orange-200",
  vitto_alloggio: "text-rose-600 bg-rose-50 border-rose-200",
  acquisto_materiale: "text-blue-600 bg-blue-50 border-blue-200",
  abbonamento_software: "text-violet-600 bg-violet-50 border-violet-200",
  noleggio: "text-cyan-600 bg-cyan-50 border-cyan-200",
  credito_ricevuto: "text-green-600 bg-green-50 border-green-200",
  altro: "text-slate-600 bg-slate-50 border-slate-200",
};

export const ExpenseIconAvatar = ({ type }: { type: string }) => {
  const Icon = expenseTypeIcons[type] ?? Receipt;
  const colorClass = expenseTypeColors[type]?.split(" ")[0] ?? "text-slate-600";
  const bgClass =
    expenseTypeColors[type]?.split(" ").slice(1).join(" ") ??
    "bg-slate-50 border-slate-200";

  return (
    <div
      className={cn(
        "flex-shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center",
        bgClass,
      )}
    >
      <Icon className={cn("h-4 w-4", colorClass)} />
    </div>
  );
};

export const computeTotal = (e: Expense, defaultKmRate: number) => {
  if (e.expense_type === "credito_ricevuto") {
    return -(e.amount ?? 0);
  }
  if (e.expense_type === "spostamento_km") {
    return calculateKmReimbursement({
      kmDistance: e.km_distance,
      kmRate: e.km_rate,
      defaultKmRate,
    });
  }
  return (e.amount ?? 0) * (1 + (e.markup_percent ?? 0) / 100);
};
