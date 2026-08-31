import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";

import { formatMonthDayString } from "../deals/dealUtils";
import { getDenverDateString } from "./artOracle/selectDailyArtwork";
import type { NextUpItem } from "./comingUpProjection";
import { useComingUpItems } from "./useComingUpItems";

// "Coming Up" — the Dashboard's temporal-intelligence section (Next Up
// slice, §5): non-Task business events (Living Example openings, GYU
// Cohort dates) in one chronological, dense list, same contained divide-y
// Card visual language as waitlist/WaitlistSection.tsx. Tasks are never
// duplicated here — see useComingUpItems.ts / comingUpProjection.ts for
// what actually feeds this and why.
export const ComingUp = () => {
  const translate = useTranslate();
  const { isPending, items } = useComingUpItems();

  if (isPending) return null;

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold">
        {translate("crm.dashboard.coming_up_title", { _: "Coming Up" })}
      </h2>
      <p className="text-sm text-muted-foreground mb-2">
        {translate("crm.dashboard.coming_up_orientation", {
          _: "Important client and program dates ahead.",
        })}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate("crm.dashboard.coming_up_empty", {
            _: "No major program or client dates coming up.",
          })}
        </p>
      ) : (
        <Card className="p-0">
          <CardContent className="p-0 divide-y">
            {items.map((item) => (
              <ComingUpRow key={item.id} item={item} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const ComingUpRow = ({ item }: { item: NextUpItem }) => {
  const translate = useTranslate();
  const { title, detail } = comingUpRowText(item, translate);
  const dateLabel =
    item.date === getDenverDateString()
      ? translate("crm.dashboard.coming_up_today", { _: "Today" })
      : formatMonthDayString(item.date);

  return (
    <Link
      to={item.destination}
      className="flex items-start gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors"
    >
      <span className="text-xs text-muted-foreground w-12 shrink-0 pt-0.5">
        {dateLabel}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-sm font-medium truncate">{title}</span>
        {detail && (
          <span className="text-xs text-muted-foreground truncate">
            {detail}
          </span>
        )}
      </div>
    </Link>
  );
};

const cohortTitleKeys = {
  cohort_start: {
    key: "crm.dashboard.coming_up_cohort_starts",
    _: "%{name} starts",
  },
  cohort_end: { key: "crm.dashboard.coming_up_cohort_ends", _: "%{name} ends" },
  cohort_applications_open: {
    key: "crm.dashboard.coming_up_cohort_applications_open",
    _: "%{name} — Applications open",
  },
  cohort_applications_close: {
    key: "crm.dashboard.coming_up_cohort_applications_close",
    _: "%{name} — Applications close",
  },
} as const;

const comingUpRowText = (
  item: NextUpItem,
  translate: (key: string, options?: Record<string, unknown>) => string,
): { title: string; detail: string | null } => {
  if (item.type === "living_example_opening") {
    const names = item.clientNames.join(" + ");
    const title = translate("crm.dashboard.coming_up_le_completes", {
      _: "%{names} completes |||| %{names} complete",
      smart_count: item.clientNames.length,
      names,
    });
    const detail = translate("crm.dashboard.coming_up_le_opening_detail", {
      _: "%{count} Living Example opening |||| %{count} Living Example openings",
      smart_count: item.openingCount,
      count: item.openingCount,
    });
    return { title, detail };
  }

  const { key, _ } = cohortTitleKeys[item.type];
  const title = translate(key, { _, name: item.cohortName });

  let detail: string | null = null;
  if (item.type === "cohort_start") {
    detail =
      item.maxCapacity != null
        ? translate("crm.dashboard.coming_up_cohort_enrolled_of_max", {
            _: "%{enrolled} / %{max} enrolled",
            enrolled: item.enrolledCount,
            max: item.maxCapacity,
          })
        : translate("crm.dashboard.coming_up_cohort_enrolled", {
            _: "%{count} enrolled",
            count: item.enrolledCount,
          });
  } else if (item.type === "cohort_end") {
    detail = translate("crm.dashboard.coming_up_cohort_completing", {
      _: "%{count} completing",
      count: item.enrolledCount,
    });
  }

  return { title, detail };
};
