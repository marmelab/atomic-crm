import type { Expense, Project, Service } from "../types";
import type { EpisodeFormData } from "./QuickEpisodeForm";

type QuickEpisodeRecord = Pick<Project, "id" | "client_id">;

const trimOptionalText = (value?: string | null) => {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : null;
};

const getDefaultExtraExpenseDescription = (
  expenseType: Expense["expense_type"],
) => {
  switch (expenseType) {
    case "acquisto_materiale":
      return "Acquisto materiale";
    case "noleggio":
      return "Noleggio";
    case "pedaggio_autostradale":
      return "Pedaggio autostradale";
    case "vitto_alloggio":
      return "Vitto e alloggio";
    case "abbonamento_software":
      return "Abbonamento software";
    default:
      return "Spesa extra";
  }
};

export const buildQuickEpisodeServiceCreateData = ({
  record,
  data,
}: {
  record: QuickEpisodeRecord;
  data: EpisodeFormData;
}): Omit<Service, "id" | "created_at"> => ({
  project_id: record.id,
  service_date: data.service_date,
  all_day: true,
  is_taxable: true,
  service_type: data.service_type,
  fee_shooting: Number(data.fee_shooting),
  fee_editing: Number(data.fee_editing),
  fee_other: Number(data.fee_other),
  discount: 0,
  km_distance: Number(data.km_distance),
  km_rate: Number(data.km_rate),
  location: trimOptionalText(data.location),
  notes: trimOptionalText(data.notes),
});

export const buildQuickEpisodeExpenseCreateData = ({
  record,
  data,
}: {
  record: QuickEpisodeRecord;
  data: EpisodeFormData;
}): Array<Omit<Expense, "id" | "created_at">> => {
  const payloads: Array<Omit<Expense, "id" | "created_at">> = [];

  // km expenses are auto-created by the DB trigger on services (sync_service_km_expense)
  // so we only build extra (non-km) expenses here.

  data.extra_expenses
    .filter((expense) => Number(expense.amount) > 0)
    .forEach((expense) => {
      const description =
        trimOptionalText(expense.description) ??
        getDefaultExtraExpenseDescription(expense.expense_type);

      payloads.push({
        project_id: record.id,
        client_id: record.client_id,
        expense_date: data.service_date,
        expense_type: expense.expense_type,
        amount: Number(expense.amount),
        markup_percent: Number(expense.markup_percent),
        description,
      });
    });

  return payloads;
};
