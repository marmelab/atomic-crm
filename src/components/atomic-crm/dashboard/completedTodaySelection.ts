import type { Task } from "../types";
import { getDenverDateString } from "./artOracle/selectDailyArtwork";

// Extracted as a pure function (an explicit `now` parameter, never
// `new Date()` internally) so the America/Denver day-boundary logic can be
// tested deterministically without faking timers — vitest-browser-react's
// render hangs under vi.useFakeTimers() in this codebase (see Dashboard.
// comingUp.test.tsx's own header), and livingExampleCapacity.test.ts
// already established injecting `now` as the reliable alternative.
export const selectCompletedToday = (
  tasks: Task[],
  now: Date = new Date(),
): Task[] => {
  const today = getDenverDateString(now);
  return tasks.filter(
    (task) =>
      task.done_date && getDenverDateString(new Date(task.done_date)) === today,
  );
};
