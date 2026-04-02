import type { FiscalDeadline } from "./fiscalModelTypes";

export const buildFiscalObligationMergeKey = ({
  component,
  competenceYear,
  dueDate,
}: {
  component: string;
  competenceYear: number;
  dueDate: string;
}) => `${component}::${competenceYear}::${dueDate}`;

const formatCompetenceYear = (value: number | null) =>
  value == null ? "none" : String(value);

export const buildFiscalDeadlineKey = (
  deadline: Pick<FiscalDeadline, "paymentYear" | "date" | "method" | "items">,
) => {
  const itemsKey = [...deadline.items]
    .map(
      (item) =>
        `${item.component}:${formatCompetenceYear(item.competenceYear)}`,
    )
    .sort()
    .join("|");

  return [
    String(deadline.paymentYear),
    deadline.date,
    deadline.method,
    itemsKey,
  ].join("::");
};
