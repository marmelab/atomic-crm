import type { Identifier } from "ra-core";

import type { Enrollment } from "../types";
import type { ProjectedEnd } from "./projectedEnd";

// One Enrollment's claim on one of an individual Offer's slots, carrying
// enough identity to name the human being on a page.
export type SlotHolder = {
  enrollmentId: Identifier;
  contactId: Identifier | null;
  name: string;
  status: Enrollment["status"];
  // The Start Week, as recorded. Null when nobody has set one.
  startDate: string | null;
  // Whether Leif actually said so. A session-derived or unexplained date
  // is still shown and still counted — refusing to plan around the only
  // dates the CRM has would be worse — but it is marked everywhere it
  // appears, and the forecast says how much of itself rests on them.
  startWeekConfirmed: boolean;
  startDateSource: Enrollment["start_date_source"];
  end: ProjectedEnd;
};

export type SlotEnrollment = Pick<
  Enrollment,
  "id" | "status" | "start_date" | "end_date"
> & {
  start_date_source?: Enrollment["start_date_source"];
  contactId?: Identifier | null;
  name?: string;
};

export const isStartWeekConfirmed = (enrollment: SlotEnrollment): boolean =>
  enrollment.start_date == null || enrollment.start_date_source === "owner";
