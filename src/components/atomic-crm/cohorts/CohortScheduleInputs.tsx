import { useEffect, useRef, useState } from "react";
import { useTranslate } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/admin/date-input";
import { NumberInput } from "@/components/admin/number-input";
import { SelectInput } from "@/components/admin/select-input";

import { endDateFor, type DurationUnit } from "./cohortDates";

const durationUnits = [
  { id: "weeks", name: "weeks" },
  { id: "months", name: "months" },
];

// Start date, how long it runs, and when it ends — for a GROUP round only.
//
// Everybody in a cohort shares these three facts, which is what makes a
// group program a different thing from a 1:1 one. A 1:1 program never gets
// them: each client there has their own Start Date and their own end
// derived from the Year Tracking calendar, and routing one through this
// form would give a shared date to people who do not share one.
//
// The end date behaves the way a person expects a calculated field to:
//
//   * while it is still the one this form worked out, changing the start
//     or the duration moves it;
//   * the moment Leif types a different date, it is HIS, and nothing
//     recalculates it out from under him;
//   * and there is a visible way back to automatic, because a field that
//     silently stops updating with no way to restart it is worse than one
//     that never updated at all.
//
// Knowing which of those it is takes a little care. Comparing the end
// against the CURRENT formula does not work: the moment the start moves,
// a perfectly derived end stops matching and would be mistaken for
// something Leif typed. So this remembers the last value it wrote. If the
// end still holds that value — or the field is empty — it is still ours.
// Anything else is his.
export const CohortScheduleInputs = () => {
  const translate = useTranslate();
  const { setValue } = useFormContext();

  const startDate = normalizeDate(useWatch({ name: "program_start_at" }));
  const durationValue = useWatch({ name: "duration_value" });
  const durationUnit = useWatch({ name: "duration_unit" });
  const endDate = normalizeDate(useWatch({ name: "program_end_at" }));

  // A cleared number input reports 0, not empty (number-input.tsx ends its
  // change handler with `?? 0`), and zero is not a length a round can have
  // — Postgres says the same through cohorts_duration_value_check. Empty,
  // NaN and zero therefore all mean the one thing: no duration yet.
  const typedLength = normalizeNumber(durationValue);
  const length = typedLength != null && typedLength > 0 ? typedLength : null;
  const duration =
    length != null && durationUnit
      ? { value: length, unit: durationUnit as DurationUnit }
      : null;
  const derivedEnd = endDateFor(startDate, duration);

  // What this form last wrote into the end field. Seeded once from the
  // record: an end that already agrees with its own start and duration was
  // calculated, whoever calculated it, so editing an existing round starts
  // out automatic exactly as creating one does.
  const ours = useRef<string | null | undefined>(undefined);
  const [, forceRender] = useState(0);
  if (ours.current === undefined) {
    ours.current = endDate == null || endDate === derivedEnd ? endDate : null;
  }
  const isDerived = endDate == null || endDate === ours.current;

  // Deliberately no dependency array. ra-core's Form re-derives its own
  // defaultValues and calls reset() as the record settles, which lands
  // AFTER a mount-time effect and silently wipes the value it wrote —
  // with the deps unchanged either side of the reset, a dependency-gated
  // effect never runs again and the field stays empty. Running after every
  // render converges instead: the guard below means a setValue only
  // happens while the two disagree, so it re-applies once after the reset
  // and then stops.
  useEffect(() => {
    if (!isDerived || derivedEnd == null || endDate === derivedEnd) return;
    ours.current = derivedEnd;
    setValue("program_end_at", derivedEnd, { shouldDirty: true });
  });

  // A duration is a NUMBER AND A UNIT, and Postgres holds it to that:
  // cohorts_duration_is_complete_check refuses a round that has one
  // without the other. Leaving the default to the dropdown's own
  // defaultValue does not survive that, because it fills the dropdown
  // without filling the form — so a round typed as "8" showed a Unit
  // reading "weeks", derived no end date from it, and would have been
  // refused on save by a constraint naming a field Leif had apparently
  // already set. Owning the pair here keeps what he sees, what the end
  // date is calculated from, and what gets written the same thing.
  useEffect(() => {
    if (typedLength != null && typedLength <= 0) {
      // Write the absence back, so a cleared field saves as "no duration"
      // rather than as a zero the database will refuse.
      setValue("duration_value", null, { shouldDirty: true });
    }
    if (length != null && !durationUnit) {
      setValue("duration_unit", "weeks", { shouldDirty: true });
    } else if (length == null && durationUnit) {
      setValue("duration_unit", null, { shouldDirty: true });
    }
  });

  const recalculate = () => {
    if (derivedEnd == null) return;
    ours.current = derivedEnd;
    setValue("program_end_at", derivedEnd, { shouldDirty: true });
    forceRender((n) => n + 1);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row gap-4">
        <DateInput
          source="program_start_at"
          label="resources.cohorts.fields.program_start_at"
          helperText={false}
        />
        <NumberInput
          source="duration_value"
          label="resources.cohorts.fields.duration_value"
          helperText={false}
          min={1}
        />
        <SelectInput
          source="duration_unit"
          label="resources.cohorts.fields.duration_unit"
          choices={durationUnits}
          helperText={false}
        />
      </div>
      <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <DateInput
          source="program_end_at"
          label="resources.cohorts.fields.program_end_at"
          helperText={false}
        />
        {derivedEnd != null &&
          (isDerived ? (
            <p className="text-xs text-muted-foreground pb-2">
              {translate("resources.cohorts.schedule.end_is_calculated", {
                _: "Calculated from the start date and duration.",
              })}
            </p>
          ) : (
            <div className="flex items-center gap-2 pb-1">
              <p className="text-xs text-muted-foreground">
                {translate("resources.cohorts.schedule.end_is_yours", {
                  _: "You set this end date, so it stays as you left it.",
                })}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={recalculate}
              >
                {translate("resources.cohorts.schedule.recalculate", {
                  _: "Recalculate",
                })}
              </Button>
            </div>
          ))}
      </div>
    </div>
  );
};

const normalizeNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// Date inputs hand back either a yyyy-mm-dd string or a Date, depending on
// how the field was filled. The schedule maths only ever deals in the
// former.
const normalizeDate = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};
