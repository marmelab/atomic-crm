import { useTranslate } from "ra-core";
import { Link } from "react-router";
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

  const programPath = `/programs/individual/${offer.id}`;

  return (
    <Card className="p-0">
      <CardContent className="p-0 flex flex-col">
        <Link
          to={programPath}
          className={`flex flex-col gap-1 p-6 hover:bg-accent/50 rounded-xl transition-colors ${
            capacity.nextOpening ? "pb-1 rounded-b-none" : ""
          }`}
        >
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
        </Link>
        {capacity.nextOpening && (
          <Link
            to={`${programPath}#upcoming-openings`}
            className="text-sm text-muted-foreground hover:underline px-6 pb-6 pt-1"
          >
            {capacity.nextOpening.countInMonth > 1
              ? translate("crm.dashboard.next_openings_in_month", {
                  _: "%{count} openings in %{month}",
                  count: capacity.nextOpening.countInMonth,
                  month: monthName(capacity.nextOpening.date.slice(0, 7)),
                })
              : translate("crm.dashboard.next_opening", {
                  _: "Next opening: %{date}",
                  date: formatMonthDay(capacity.nextOpening.date),
                })}
          </Link>
        )}
      </CardContent>
    </Card>
  );
};
