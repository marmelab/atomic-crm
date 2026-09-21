import type { Identifier } from "ra-core";

import type { Enrollment } from "../types";
import type { ExpectedEnd } from "./sessionWeeks";

// One Enrollment's claim on one of an individual Offer's slots, carrying
// enough identity to name the human being on a page.
export type SlotHolder = {
  enrollmentId: Identifier;
  contactId: Identifier | null;
  name: string;
  status: Enrollment["status"];
  // The Start Date — the week of Session #1, set by Leif. Null when he
  // has not set one, which is a question for him and never something to
  // infer from a booking.
  startDate: string | null;
  // Whether Leif actually said so. A date inferred from a client's first
  // booked session is not a Start Date; it is a guess that happens to be
  // written down.
  startWeekConfirmed: boolean;
  startDateSource: Enrollment["start_date_source"];
  // Derived from the Year Tracking calendar: the 12th eligible `1:1s`
  // week, plus one more week per cross-week reschedule. Null when there
  // is no Start Date to count from; `incomplete` when Leif has not filled
  // the calendar far enough ahead to reach the 12th week.
  end: ExpectedEnd | null;
  // Cross-week reschedules recorded against this Enrollment.
  extensions: number;
};

export type SlotEnrollment = Pick<
  Enrollment,
  "id" | "status" | "start_date" | "end_date"
> & {
  start_date_source?: Enrollment["start_date_source"];
  contactId?: Identifier | null;
  name?: string;
  // Cadence-issue classifications recorded against this Enrollment. Only
  // 'rescheduled' extends a container; see sessionWeeks.ts.
  cadenceClassifications?: (string | null)[];
};

export const isStartWeekConfirmed = (enrollment: SlotEnrollment): boolean =>
  enrollment.start_date == null || enrollment.start_date_source === "owner";
