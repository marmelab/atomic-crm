import { ShowBase, useShowContext, useGetList } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { Building2, Mail, Phone, FileText, Receipt, Tag } from "lucide-react";
import { CloudinaryImageField } from "../cloudinary/CloudinaryImageField";
import { Link } from "react-router";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Expense, Supplier } from "../types";
import { ErrorMessage } from "../misc/ErrorMessage";
import { MobileBackButton } from "../misc/MobileBackButton";
import { TagsListEdit } from "../tags/TagsListEdit";
import { SupplierContactsSection } from "../contacts/SupplierContactsSection";
import { SupplierTasksSection } from "./SupplierTasksSection";
import { SupplierNotesSection } from "./SupplierNotesSection";
import {
  SupplierFinancialSummary,
  SupplierFinancialDocsCard,
} from "./SupplierFinancialSection";
import { expenseTypeLabels } from "../expenses/expenseTypes";

const eur = (n: number) =>
  n.toLocaleString("it-IT", { minimumFractionDigits: 2 });

export const SupplierShow = () => (
  <ShowBase>
    <SupplierShowContent />
  </ShowBase>
);

const SupplierShowContent = () => {
  const { record, isPending, error } = useShowContext<Supplier>();
  const isMobile = useIsMobile();

  if (error) return <ErrorMessage />;
  if (isPending || !record) return null;

  return (
    <div className="mt-4 mb-28 md:mb-2 flex flex-col gap-6 px-4 md:px-0">
      {isMobile && (
        <div className="mb-3">
          <MobileBackButton />
        </div>
      )}

      <Card>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              {record.logo_url && (
                <CloudinaryImageField
                  url={record.logo_url}
                  alt={record.name}
                  mode="avatar"
                />
              )}
              <div>
                <h2 className="text-xl md:text-2xl font-bold">{record.name}</h2>
                {record.vat_number && (
                  <p className="text-sm text-muted-foreground mt-1">
                    P.IVA: {record.vat_number}
                  </p>
                )}
              </div>
            </div>
            <TagsListEdit resource="suppliers" />
            <div className="flex flex-wrap gap-2">
              <EditButton />
              <DeleteButton redirect="list" />
            </div>
          </div>

          <Separator className="my-4" />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h6 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Contatti
              </h6>
              {record.email && (
                <InfoRow
                  icon={<Mail className="size-4" />}
                  value={record.email}
                />
              )}
              {record.phone && (
                <InfoRow
                  icon={<Phone className="size-4" />}
                  value={record.phone}
                />
              )}
              {record.address && (
                <InfoRow
                  icon={<Building2 className="size-4" />}
                  value={record.address}
                />
              )}
              {record.default_expense_type && (
                <InfoRow
                  icon={<Tag className="size-4" />}
                  label="Tipo spesa"
                  value={
                    expenseTypeLabels[record.default_expense_type] ??
                    record.default_expense_type
                  }
                />
              )}
            </div>

            <div className="space-y-3">
              <h6 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Dati fiscali
              </h6>
              {record.vat_number && (
                <InfoRow
                  icon={<FileText className="size-4" />}
                  label="P.IVA"
                  value={record.vat_number}
                />
              )}
              {record.fiscal_code && (
                <InfoRow
                  icon={<FileText className="size-4" />}
                  label="C.F."
                  value={record.fiscal_code}
                />
              )}
              {record.billing_pec && (
                <InfoRow
                  icon={<Mail className="size-4" />}
                  label="PEC"
                  value={record.billing_pec}
                />
              )}
              {record.billing_sdi_code && (
                <InfoRow
                  icon={<FileText className="size-4" />}
                  label="SDI"
                  value={record.billing_sdi_code}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SupplierContactsSection />
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SupplierTasksSection />
        </CardContent>
      </Card>

      {record.id && <SupplierExpensesCard supplierId={String(record.id)} />}

      <Card>
        <CardContent>
          <SupplierNotesSection />
        </CardContent>
      </Card>

      {record.id && (
        <Card>
          <CardContent>
            <SupplierFinancialSummary supplierId={String(record.id)} />
            <Separator className="my-4" />
            <SupplierFinancialDocsCard supplierId={String(record.id)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const SupplierExpensesCard = ({ supplierId }: { supplierId: string }) => {
  const { data: expenses, isPending } = useGetList<Expense>("expenses", {
    filter: { "supplier_id@eq": supplierId },
    pagination: { page: 1, perPage: 20 },
    sort: { field: "expense_date", order: "DESC" },
  });

  if (isPending) return null;

  return (
    <Card>
      <CardContent>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Spese collegate
        </h3>
        {!expenses?.length ? (
          <p className="text-sm text-muted-foreground">
            Nessuna spesa collegata a questo fornitore.
          </p>
        ) : (
          <div className="space-y-2">
            {expenses.map((expense) => (
              <Link
                key={expense.id}
                to={`/expenses/${expense.id}/show`}
                className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/50"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Receipt className="size-4 text-muted-foreground" />
                  <span>
                    {expenseTypeLabels[expense.expense_type] ??
                      expense.expense_type}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(expense.expense_date).toLocaleDateString("it-IT")}
                  </span>
                </div>
                <span className="text-sm font-medium">
                  EUR {eur(expense.amount ?? 0)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label?: string;
  value: string;
}) => (
  <div className="flex items-center gap-2 text-sm">
    <span className="text-muted-foreground">{icon}</span>
    {label && (
      <span className="font-medium text-muted-foreground">{label}:</span>
    )}
    <span>{value}</span>
  </div>
);
