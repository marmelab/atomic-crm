import { useTranslate } from "ra-core";

import { cn } from "@/lib/utils";
import { weekLabel } from "./monthLabel";
import type { Availability } from "./openingsNarrative";

// The answer to "can I take another client?", rendered.
//
// One component for the headline and for every month card, because the two
// must never disagree — not only in the number, which openingsNarrative.ts
// already guarantees, but in the words. A card reading "no opening" above a
// summary reading "can't calculate" is the same failure as a wrong number,
// and it is the kind that survives review because both halves look fine on
// their own.
//
// The two variants differ in what leads, and deliberately:
//
//   headline   the WEEK is the answer, the count qualifies it. Leif has a
//              rough feel for how full he is; what he cannot work out in
//              his head is WHEN. The first pass had "1 NEW CLIENT CAN
//              START" in large type with "week of Nov 29" whispered
//              underneath, and he said the useful half was the whisper.
//
//   card       the month is already the heading, so the count leads and
//              the week says where inside the month it falls.
//
// A card also never speaks globally: "No opening this month" scopes to the
// month it is in, while "No opening yet" belongs only to the summary that
// owns the whole forecast.
export const AvailabilityAnswer = ({
  availability,
  variant,
}: {
  availability: Availability;
  variant: "headline" | "card";
}) => {
  const translate = useTranslate();
  const isHeadline = variant === "headline";
  const leadClass = cn(
    "font-semibold",
    isHeadline ? "text-xl" : "text-sm",
    availability.kind === "safe_opening" && "text-primary",
  );
  const subClass = cn(
    "text-muted-foreground",
    isHeadline ? "text-sm" : "text-xs",
  );

  if (availability.kind === "safe_opening") {
    const week = translate("crm.programs.availability_open_week", {
      _: "Week of %{date}",
      date: weekLabel(availability.week.week.start),
    });
    const count = isHeadline
      ? translate("crm.programs.availability_open_count", {
          _: "%{count} client can start |||| %{count} clients can start",
          smart_count: availability.openings,
          count: availability.openings,
        })
      : translate("crm.programs.availability_open_card", {
          _: "%{count} opening |||| %{count} openings",
          smart_count: availability.openings,
          count: availability.openings,
        });

    return (
      <div className="flex flex-col gap-0.5">
        <p className={leadClass}>{isHeadline ? week : count}</p>
        <p className={subClass}>{isHeadline ? count : week}</p>
      </div>
    );
  }

  if (availability.kind === "no_opening") {
    return (
      <div className="flex flex-col gap-0.5">
        <p className={leadClass}>
          {isHeadline
            ? translate("crm.programs.availability_none", {
                _: "No opening yet",
              })
            : translate("crm.programs.availability_none_month", {
                _: "No opening this month",
              })}
        </p>
        {/* The explanation belongs to the forecast as a whole. On a card
            it would repeat under every month and say nothing about the
            month it is in. */}
        {isHeadline && (
          <>
            <p className={subClass}>
              {translate("crm.programs.availability_none_why", {
                _: "Your current and already-booked clients keep the programme at capacity through %{date}.",
                date: availability.testedThrough
                  ? weekLabel(availability.testedThrough)
                  : "—",
              })}
            </p>
            {availability.calendarRunsOut && (
              <p className={subClass}>
                {translate("crm.programs.availability_none_horizon", {
                  _: "Weeks after that can't be checked yet — Year Tracking ends %{horizon}. Add more 1:1 weeks, then Sync Calendar.",
                  horizon: availability.horizon
                    ? weekLabel(availability.horizon)
                    : "—",
                })}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  // Can't calculate. The distinction that matters, and the one the first
  // screen buried under the word "unknown": this is not "you have no
  // openings". It is "I cannot see far enough ahead to tell you", and the
  // thing that fixes it is a calendar Leif owns.
  return (
    <div className="flex flex-col gap-0.5">
      <p className={leadClass}>
        {isHeadline
          ? translate("crm.programs.availability_unknown_headline", {
              _: "Can't calculate yet",
            })
          : translate("crm.programs.availability_unknown_card", {
              _: "Can't calculate this month yet",
            })}
      </p>
      {isHeadline && (
        <>
          <p className={subClass}>
            {translate("crm.programs.availability_unknown_why", {
              _: "Year Tracking ends %{horizon} — not far enough to see a full 12-session schedule for someone starting now.",
              horizon: availability.horizon
                ? weekLabel(availability.horizon)
                : "—",
            })}
          </p>
          <p className="text-sm">
            {translate("crm.programs.availability_unknown_action", {
              _: "Add more 1:1 weeks to Year Tracking, then Sync Calendar.",
            })}
          </p>
        </>
      )}
    </div>
  );
};
