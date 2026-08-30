export type CohortThresholdStatus =
  | "below_minimum"
  | "minimum_reached"
  | "target_reached"
  | "full"
  | "unknown";

// Describes where a Cohort's enrolled count sits relative to its own
// minimum/target/maximum thresholds. Pure formatting only — the enrolled
// count itself must come from the shared cohort capacity classification
// (cohorts/useCohortCapacity.ts), never recomputed here.
export const describeCohortThreshold = ({
  enrolled,
  minimum,
  target,
  maximum,
}: {
  enrolled: number;
  minimum?: number | null;
  target?: number | null;
  maximum?: number | null;
}): CohortThresholdStatus => {
  if (maximum != null && enrolled >= maximum) return "full";
  if (target != null && enrolled >= target) return "target_reached";
  if (minimum != null && enrolled >= minimum) return "minimum_reached";
  if (minimum != null) return "below_minimum";
  return "unknown";
};
