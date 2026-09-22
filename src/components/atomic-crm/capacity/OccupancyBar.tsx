import { useTranslate } from "ra-core";

import { cn } from "@/lib/utils";

// How full the practice is, at a glance.
//
// One cell per client, against a ceiling that is drawn rather than
// described — because "Peak 14 in the programme" was a number with no unit
// attached, and Leif's first question about it was whether it meant he had
// fourteen people enrolled.
//
// Anything past the ceiling is drawn past the ceiling, in the colour of a
// problem, rather than clamped to a full bar. Six people committed to
// start in November genuinely do take this practice over twelve, and a bar
// that maxes out at twelve would hide the one thing worth seeing.
export const OccupancyBar = ({
  occupancy,
  max,
  className,
}: {
  occupancy: number;
  max: number;
  className?: string;
}) => {
  const translate = useTranslate();
  const filled = Math.min(occupancy, max);
  const over = Math.max(occupancy - max, 0);
  const empty = Math.max(max - occupancy, 0);

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="img"
      aria-label={
        over > 0
          ? translate("crm.programs.occupancy_bar_over", {
              _: "%{occupancy} active clients, %{over} over a capacity of %{max}",
              occupancy,
              over,
              max,
            })
          : translate("crm.programs.occupancy_bar", {
              _: "%{occupancy} active clients out of a capacity of %{max}",
              occupancy,
              max,
            })
      }
    >
      {Array.from({ length: filled }, (_, i) => (
        <span
          key={`filled-${i}`}
          className="h-3 w-1.5 rounded-[1px] bg-primary"
        />
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <span
          key={`empty-${i}`}
          className="h-3 w-1.5 rounded-[1px] bg-muted border border-border"
        />
      ))}
      {over > 0 && (
        <>
          {/* The ceiling itself, so "over" is visibly over something. */}
          <span className="mx-0.5 h-4 w-px bg-foreground" aria-hidden="true" />
          {Array.from({ length: over }, (_, i) => (
            <span
              key={`over-${i}`}
              className="h-3 w-1.5 rounded-[1px] bg-destructive"
            />
          ))}
        </>
      )}
    </div>
  );
};

// "14 active · capacity 12 · 2 over" — the words that go with the bar.
export const OccupancyLabel = ({
  occupancy,
  max,
}: {
  occupancy: number;
  max: number;
}) => {
  const translate = useTranslate();
  const over = Math.max(occupancy - max, 0);

  return (
    <span className="text-sm">
      <span className={cn("font-medium", over > 0 && "text-destructive")}>
        {translate("crm.programs.occupancy_active", {
          _: "%{count} active",
          count: occupancy,
        })}
      </span>
      <span className="text-muted-foreground">
        {" · "}
        {translate("crm.programs.occupancy_capacity", {
          _: "capacity %{max}",
          max,
        })}
      </span>
      {over > 0 && (
        <span className="text-destructive">
          {" · "}
          {translate("crm.programs.occupancy_over", {
            _: "%{count} over",
            count: over,
          })}
        </span>
      )}
    </span>
  );
};

// "Session weeks found ■■■■■■■■■■■□ 11 of 12" — why a start cannot be
// tested yet, shown rather than asserted.
export const SessionWeeksFound = ({
  scheduled,
  required,
}: {
  scheduled: number;
  required: number;
}) => {
  const translate = useTranslate();
  const missing = Math.max(required - scheduled, 0);

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">
        {translate("crm.programs.session_weeks_found", {
          _: "Session weeks in your calendar for a start this week",
        })}
      </p>
      <div
        className="flex items-center gap-0.5"
        role="img"
        aria-label={translate("crm.programs.session_weeks_of", {
          _: "%{scheduled} of %{required} session weeks",
          scheduled,
          required,
        })}
      >
        {Array.from({ length: Math.min(scheduled, required) }, (_, i) => (
          <span key={`has-${i}`} className="h-3 w-2 rounded-[1px] bg-primary" />
        ))}
        {Array.from({ length: missing }, (_, i) => (
          <span
            key={`missing-${i}`}
            className="h-3 w-2 rounded-[1px] border border-dashed border-border"
          />
        ))}
        <span className="ml-2 text-xs text-muted-foreground">
          {translate("crm.programs.session_weeks_of", {
            _: "%{scheduled} of %{required} session weeks",
            scheduled,
            required,
          })}
        </span>
      </div>
    </div>
  );
};
