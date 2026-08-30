import { useTranslate } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";

import { useLivingExampleCapacityData } from "./useLivingExampleCapacityData";

// Formats a "YYYY-MM-DD" or "YYYY-MM" date string without the UTC/local
// off-by-one risk that new Date(str).toLocaleDateString() can produce for
// date-only strings — same rationale as deals/dealUtils.ts.
const formatMonthDay = (isoDate: string) => {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

const monthName = (yearMonth: string) => {
  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(year!, month! - 1, 1).toLocaleDateString("en-US", {
    month: "long",
  });
};

export const LivingExampleCapacityCard = () => {
  const translate = useTranslate();
  const { isPending, offer, capacity } = useLivingExampleCapacityData();

  if (isPending) return null;
  if (!offer || !capacity) return null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <p className="text-sm font-medium">{offer.name}</p>
        <p className="text-2xl font-semibold">
          {capacity.active}
          {capacity.max != null && (
            <span className="text-muted-foreground text-lg">
              {" "}
              / {capacity.max}
            </span>
          )}
          <span className="text-sm text-muted-foreground font-normal">
            {" "}
            {translate("crm.dashboard.capacity_active", { _: "active" })}
          </span>
        </p>
        {capacity.openings != null && (
          <p className="text-sm text-muted-foreground">
            {translate("crm.dashboard.capacity_openings", {
              _: "%{count} openings",
              count: capacity.openings,
            })}
          </p>
        )}
        {capacity.nextOpening &&
          (capacity.nextOpening.countInMonth > 1 ? (
            <p className="text-sm text-muted-foreground">
              {translate("crm.dashboard.next_openings_in_month", {
                _: "%{count} openings in %{month}",
                count: capacity.nextOpening.countInMonth,
                month: monthName(capacity.nextOpening.date.slice(0, 7)),
              })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {translate("crm.dashboard.next_opening", {
                _: "Next opening: %{date}",
                date: formatMonthDay(capacity.nextOpening.date),
              })}
            </p>
          ))}
      </CardContent>
    </Card>
  );
};
