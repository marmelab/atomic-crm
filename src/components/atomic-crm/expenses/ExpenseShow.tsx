import { ShowBase, useShowContext, useGetOne } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { Calendar, FileText } from "lucide-react";
import { Link } from "react-router";
import { calculateKmReimbursement } from "@/lib/semantics/crmSemanticRegistry";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Expense } from "../types";
import { expenseTypeLabels } from "./expenseTypes";
import { ErrorMessage } from "../misc/ErrorMessage";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { MobileBackButton } from "../misc/MobileBackButton";

const eur = (n: number) =>
  n.toLocaleString("it-IT", { minimumFractionDigits: 2 });

const computeTotal = (e: Expense, defaultKmRate: number) => {
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

export const ExpenseShow = () => (
  <ShowBase>
    <ExpenseShowContent />
  </ShowBase>
);

const ExpenseShowContent = () => {
  const { record, isPending, error } = useShowContext<Expense>();
  const { operationalConfig } = useConfigurationContext();
  const { data: project } = useGetOne(
    "projects",
    {
      id: record?.project_id,
    },
    {
      enabled: !!record?.project_id,
    },
  );
  const isMobile = useIsMobile();

  if (error) return <ErrorMessage />;
  if (isPending || !record) return null;

  const total = computeTotal(record, operationalConfig.defaultKmRate);

  return (
    <div className="mt-4 mb-28 md:mb-2 flex gap-8 px-4 md:px-0">
      <div className="flex-1">
        {isMobile && (
          <div className="mb-3">
            <MobileBackButton />
          </div>
        )}
        <Card>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="text-2xl font-bold">
                  {expenseTypeLabels[record.expense_type]} — EUR {eur(total)}
                </h2>
                {record.expense_type === "credito_ricevuto" ? (
                  <div className="mt-2">
                    <Badge variant="secondary" className="text-green-700">
                      Credito ricevuto
                    </Badge>
                  </div>
                ) : null}
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    {new Date(record.expense_date).toLocaleDateString("it-IT")}
                  </span>
                  {project && (
                    <Link
                      to={`/projects/${record.project_id}/show`}
                      className="text-primary hover:underline"
                    >
                      {project.name}
                    </Link>
                  )}
                  {record.invoice_ref && (
                    <span className="flex items-center gap-1">
                      <FileText className="size-3" />
                      {record.invoice_ref}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <EditButton />
                <DeleteButton redirect="list" />
              </div>
            </div>
            <Separator className="my-4" />
            <ExpenseDetails
              record={record}
              total={total}
              defaultKmRate={operationalConfig.defaultKmRate}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const ExpenseDetails = ({
  record,
  total,
  defaultKmRate,
}: {
  record: Expense;
  total: number;
  defaultKmRate: number;
}) => {
  const isKm = record.expense_type === "spostamento_km";
  const isCredit = record.expense_type === "credito_ricevuto";

  return (
    <div className="space-y-2 max-w-sm">
      {isCredit ? (
        <DetailRow
          label="Valore credito"
          value={`EUR ${eur(record.amount ?? 0)}`}
        />
      ) : isKm ? (
        <>
          <DetailRow
            label="Km percorsi"
            value={String(record.km_distance ?? 0)}
          />
          <DetailRow
            label="Tariffa km"
            value={`EUR ${eur(record.km_rate ?? defaultKmRate)}`}
          />
        </>
      ) : (
        <>
          <DetailRow
            label="Importo base"
            value={`EUR ${eur(record.amount ?? 0)}`}
          />
          <DetailRow
            label="Ricarico"
            value={`${record.markup_percent ?? 0}%`}
          />
        </>
      )}
      <div className="border-t pt-2 flex justify-between font-bold text-sm">
        <span>Totale</span>
        <span>EUR {eur(total)}</span>
      </div>
      {record.description && (
        <div className="pt-3">
          <p className="text-sm text-muted-foreground">{record.description}</p>
        </div>
      )}
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span>{value}</span>
  </div>
);
