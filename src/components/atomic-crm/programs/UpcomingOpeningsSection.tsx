import { useTranslate } from "ra-core";
import { Card, CardContent } from "@/components/ui/card";

import type {
  FutureOpenings,
  OpeningsMonth,
} from "../capacity/individualCapacity";
import { monthLabel } from "../capacity/monthLabel";
import { Section } from "../misc/ProgramLayout";

// When slots actually become available.
//
// The old version of this section read Enrollment.end_date and grouped it
// by exact day. No Living Example Enrollment has ever carried an end_date,
// so it rendered "No upcoming openings." permanently, while two clients
// were due to finish in October.
//
// It also counted only departures. Leif has six people already agreed to
// start — "two openings in October" would have been an invitation to sell
// a slot he had already sold. Arrivals and departures are now in the same
// ledger, and what the row reports is what is left afterwards.
export const UpcomingOpeningsSection = ({
  futureOpenings,
}: {
  futureOpenings: FutureOpenings;
}) => {
  const translate = useTranslate();
  const { months, unknownEnd } = futureOpenings;

  return (
    <Section
      id="upcoming-openings"
      title={translate("crm.programs.upcoming_openings", {
        _: "Upcoming Openings",
      })}
    >
      {months.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate("crm.programs.no_upcoming_openings", {
            _: "No upcoming openings.",
          })}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {months.map((month) => (
            <MonthRow key={month.month} month={month} />
          ))}
        </div>
      )}
      {unknownEnd.length > 0 && (
        // The projection is knowingly incomplete, and says by how much.
        // Silently leaving these people out would make the months above
        // look more certain than they are.
        <p className="mt-2 text-xs text-muted-foreground">
          {translate("crm.programs.openings_unknown_end", {
            _: "Not included: %{names} — no end date, and no programme length to work one out from.",
            names: unknownEnd
              .map(
                (holder) =>
                  holder.name ||
                  translate("crm.programs.unnamed_client", {
                    _: "an unnamed client",
                  }),
              )
              .join(", "),
          })}
        </p>
      )}
    </Section>
  );
};

const MonthRow = ({ month }: { month: OpeningsMonth }) => {
  const translate = useTranslate();
  const overCommitted = month.netAvailableAfter < 0;

  return (
    <Card className="p-0">
      <CardContent className="px-4 py-2.5 flex flex-col gap-0.5">
        <p className="text-sm font-medium">
          {monthLabel(month.month)}
          {" — "}
          {overCommitted ? (
            <span className="text-destructive">
              {translate("crm.programs.opening_over_committed", {
                _: "%{count} more starting than there is room for",
                count: -month.netAvailableAfter,
              })}
            </span>
          ) : (
            translate("crm.programs.opening_count", {
              _: "%{count} opening |||| %{count} openings",
              smart_count: month.netAvailableAfter,
              count: month.netAvailableAfter,
            })
          )}
        </p>
        {month.freeing.length > 0 && (
          <p className="text-xs text-muted-foreground truncate">
            {translate("crm.programs.opening_completes", {
              _: "%{names} expected to finish",
              names: month.freeing.map((holder) => holder.name).join(", "),
            })}
          </p>
        )}
        {month.committing.length > 0 && (
          <p className="text-xs text-muted-foreground truncate">
            {translate("crm.programs.opening_starts", {
              _: "%{names} already booked to start",
              names: month.committing.map((holder) => holder.name).join(", "),
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
