import type { SessionWeek } from "./sessionWeeks";

// A synthetic Year Tracking calendar for tests: `count` Mon–Fri `1:1s`
// weeks from `from`, one per week, minus any week listed in `skip`.
//
// `skip` is how a test expresses a closed week — a holiday, travel, the
// summer. A skipped week is simply absent from the calendar, which is
// exactly how Leif's real one represents it: there are no `1:1s` events at
// all between 2 July and 13 September 2026.
export const weeklyCalendar = (
  from: string,
  count: number,
  skip: string[] = [],
): SessionWeek[] => {
  const weeks: SessionWeek[] = [];
  const cursor = new Date(`${from}T00:00:00Z`);
  // Bounded so a bad `skip` can never spin: at most a year of candidates.
  for (let attempts = 0; weeks.length < count && attempts < 60; attempts++) {
    const start = cursor.toISOString().slice(0, 10);
    cursor.setUTCDate(cursor.getUTCDate() + 7);
    if (skip.includes(start)) continue;
    const end = new Date(`${start}T00:00:00Z`);
    // Mon–Fri, exclusive end: Monday + 5 days = Saturday.
    end.setUTCDate(end.getUTCDate() + 5);
    weeks.push({ start, end: end.toISOString().slice(0, 10), title: "1:1s" });
  }
  return weeks;
};
