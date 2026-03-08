import { Banknote, FileText, Receipt, Wrench } from "lucide-react";

import { Separator } from "@/components/ui/separator";

type DraftSummaryGroup = {
  label: string;
  count: number;
  total: number;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  });

const groupIcons: Record<string, typeof Banknote> = {
  payments: Banknote,
  expenses: Receipt,
  services: Wrench,
};

const groupColors: Record<string, string> = {
  payments: "text-emerald-600 dark:text-emerald-400",
  expenses: "text-red-600 dark:text-red-400",
  services: "text-sky-600 dark:text-sky-400",
};

export const AiDraftSummaryBar = ({
  groups,
  totalRecords,
}: {
  groups: Array<DraftSummaryGroup & { resource: string }>;
  totalRecords: number;
}) => {
  const visibleGroups = groups.filter((g) => g.count > 0);

  if (visibleGroups.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[#2C3E50]/20 bg-[#E8EDF2] px-4 py-3 dark:bg-[#2C3E50]/20">
      <div className="mb-2 flex items-center gap-2">
        <FileText className="size-4 text-[#2C3E50] dark:text-[#E8EDF2]" />
        <span className="text-xs font-medium text-[#2C3E50] dark:text-[#E8EDF2]">
          Riepilogo bozza — {totalRecords}{" "}
          {totalRecords === 1 ? "record" : "record"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {visibleGroups.map((group, i) => {
          const Icon = groupIcons[group.resource] ?? FileText;
          const color = groupColors[group.resource] ?? "text-[#456B6B]";

          return (
            <div key={group.resource} className="flex items-center gap-3">
              {i > 0 ? (
                <Separator
                  orientation="vertical"
                  className="h-8 bg-[#2C3E50]/20"
                />
              ) : null}
              <div className="flex items-center gap-2">
                <Icon className={`size-4 ${color}`} />
                <div>
                  <p className={`text-lg font-bold leading-tight ${color}`}>
                    {formatCurrency(group.total)}
                  </p>
                  <p className="text-[11px] text-[#2C3E50]/70 dark:text-[#E8EDF2]/70">
                    {group.count} {group.label}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
