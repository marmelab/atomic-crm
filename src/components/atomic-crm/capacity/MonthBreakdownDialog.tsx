import { useTranslate } from "ra-core";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { monthLabel } from "./monthLabel";
import { AvailabilityAnswer } from "./AvailabilityAnswer";
import type { MonthAvailability } from "./openingsNarrative";
import { WeekBreakdown } from "./WeekBreakdown";

// The whole calculation for one month, opened in place.
//
// Leif asked to be able to click a month and see how the answer was
// reached. Everything below is read off the same evaluation the card
// showed — the conclusion at the top is literally the same component the
// card renders, so the drilldown cannot quietly tell a different story
// from the thing that was clicked.
export const MonthBreakdownDialog = ({
  month,
  onClose,
}: {
  month: MonthAvailability | null;
  onClose: () => void;
}) => {
  const translate = useTranslate();

  return (
    <Dialog open={month != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        {month && (
          <>
            <DialogHeader>
              <DialogTitle>
                {translate("crm.programs.month_breakdown_title", {
                  _: "%{month} — capacity breakdown",
                  month: monthLabel(month.month),
                })}
              </DialogTitle>
              <DialogDescription>
                {translate("crm.programs.month_breakdown_intro", {
                  _: "Week by week, and what each week's answer comes from.",
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg border bg-muted/40 p-3">
              <AvailabilityAnswer
                availability={month.availability}
                variant="headline"
              />
            </div>

            <ul className="flex flex-col gap-2">
              {month.weeks.map((week) => (
                <WeekBreakdown key={week.week.start} week={week} />
              ))}
            </ul>

            {month.weeks.length === 0 && (
              // A month with no `1:1s` weeks at all is not a month at
              // capacity — it is a month Leif is closed, and saying so is
              // the difference between "you are full" and "you are away".
              <p className="text-sm text-muted-foreground">
                {translate("crm.programs.month_no_weeks", {
                  _: "Year Tracking has no 1:1 weeks in this month, so nobody can start or finish in it.",
                })}
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
