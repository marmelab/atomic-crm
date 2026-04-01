import { useGetOne } from "ra-core";
import { Euro, TrendingUp, TrendingDown, Car } from "lucide-react";
import type { Client, ClientCommercialPosition } from "../types";

const eur = (n: number) =>
  n.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

type Props = { record: Client };

export const ClientFinancialSummary = ({ record }: Props) => {
  const { data, isPending } = useGetOne<ClientCommercialPosition>(
    "client_commercial_position",
    { id: record.id },
    { enabled: !!record.id },
  );

  if (isPending || !data) return null;

  const totalFees = toNum(data.total_fees);
  const totalExpenses = toNum(data.total_expenses);
  const totalPaid = toNum(data.total_paid);
  const balanceDue = toNum(data.balance_due);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard
        icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
        label="Compensi"
        value={eur(totalFees)}
      />
      <MetricCard
        icon={<Car className="h-4 w-4 text-orange-600" />}
        label="Spese"
        value={eur(totalExpenses)}
      />
      <MetricCard
        icon={<Euro className="h-4 w-4 text-emerald-600" />}
        label="Pagato"
        value={eur(totalPaid)}
      />
      <MetricCard
        icon={
          <TrendingDown
            className={`h-4 w-4 ${balanceDue < 0 ? "text-blue-600" : "text-red-600"}`}
          />
        }
        label={balanceDue < 0 ? "Credito cliente" : "Da saldare"}
        value={eur(Math.abs(balanceDue))}
        className={balanceDue < 0 ? "text-blue-700" : undefined}
      />
    </div>
  );
};

const MetricCard = ({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}) => (
  <div className="flex flex-col gap-1 rounded-lg border p-3">
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon}
      {label}
    </div>
    <div className={`text-sm font-semibold ${className ?? ""}`}>{value}</div>
  </div>
);
