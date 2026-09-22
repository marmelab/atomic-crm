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
export const AvailabilityAnswer = ({
  availability,
  variant,
}: {
  availability: Availability;
  variant: "headline" | "card";
}) => {
  const translate = useTranslate();
  const isHeadline = variant === "headline";
  const answerClass = cn(
    "font-semibold",
    isHeadline ? "text-lg" : "text-sm",
    availability.kind === "safe_opening" && "text-primary",
  );
  const whyClass = cn(
    "text-muted-foreground",
    isHeadline ? "text-sm" : "text-xs",
  );

  if (availability.kind === "safe_opening") {
    return (
      <div className="flex flex-col gap-0.5">
        <p className={answerClass}>
          {isHeadline
            ? translate("crm.programs.availability_open_headline", {
                _: "%{count} new client can start |||| %{count} new clients can start",
                smart_count: availability.openings,
                count: availability.openings,
              })
            : translate("crm.programs.availability_open_card", {
                _: "%{count} safe opening |||| %{count} safe openings",
                smart_count: availability.openings,
                count: availability.openings,
              })}
        </p>
        <p className={whyClass}>
          {translate("crm.programs.availability_open_when", {
            _: "Earliest safe start: week of %{date}",
            date: weekLabel(availability.week.week.start),
          })}
        </p>
      </div>
    );
  }

  if (availability.kind === "no_opening") {
    return (
      <div className="flex flex-col gap-0.5">
        <p className={answerClass}>
          {translate("crm.programs.availability_none", {
            _: "No opening yet",
          })}
        </p>
        <p className={whyClass}>
          {translate("crm.programs.availability_none_why", {
            _: "Your current and already-booked clients keep the programme at capacity through %{date}.",
            date: availability.testedThrough
              ? weekLabel(availability.testedThrough)
              : "—",
          })}
        </p>
        {availability.calendarRunsOut && (
          <>
            <p className={whyClass}>
              {translate("crm.programs.availability_none_horizon", {
                _: "Weeks after that can't be checked yet — Year Tracking ends %{horizon}.",
                horizon: availability.horizon
                  ? weekLabel(availability.horizon)
                  : "—",
              })}
            </p>
            {/* "No opening yet" is only half true when the calendar also
                runs out: an opening could be sitting just past the end of
                Year Tracking. The way to find out is the same one action
                as below, so it is offered here too rather than leaving
                Leif with a dead end. */}
            {isHeadline && (
              <p className="text-sm">
                {translate("crm.programs.availability_unknown_action", {
                  _: "Add more 1:1 weeks to Year Tracking, then Sync Calendar.",
                })}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  // Can't calculate. The distinction that matters, and the one the old
  // screen buried under the word "unknown": this is not "you have no
  // openings". It is "I cannot see far enough ahead to tell you", and the
  // thing that fixes it is a calendar Leif owns.
  return (
    <div className="flex flex-col gap-0.5">
      <p className={answerClass}>
        {isHeadline
          ? translate("crm.programs.availability_unknown_headline", {
              _: "Can't calculate your next opening yet",
            })
          : translate("crm.programs.availability_unknown_card", {
              _: "Can't calculate safely yet",
            })}
      </p>
      <p className={whyClass}>
        {translate("crm.programs.availability_unknown_why", {
          _: "Year Tracking ends %{horizon}, which isn't far enough to see a full 12-session schedule for someone starting now.",
          horizon: availability.horizon ? weekLabel(availability.horizon) : "—",
        })}
      </p>
      <p className={whyClass}>
        {translate("crm.programs.availability_unknown_detail", {
          _: "The closest week has %{scheduled} of the %{required} 1:1 weeks it needs.",
          scheduled: availability.weeksScheduled,
          required: availability.weeksRequired,
        })}
      </p>
      {isHeadline && (
        <p className="text-sm">
          {translate("crm.programs.availability_unknown_action", {
            _: "Add more 1:1 weeks to Year Tracking, then Sync Calendar.",
          })}
        </p>
      )}
    </div>
  );
};
