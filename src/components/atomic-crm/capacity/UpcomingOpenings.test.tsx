import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { CoreAdminContext, memoryStore } from "ra-core";

import { testI18nProvider } from "../providers/commons/i18nProvider";
import { createDataProvider } from "../providers/fakerest";
import { createCrmDb, createTestAuthProvider } from "@/test/StoryWrapper";
import { UpcomingOpeningsSection } from "../programs/UpcomingOpeningsSection";
import {
  computeFutureOpenings,
  computeIndividualCapacity,
  type SlotEnrollment,
} from "./individualCapacity";
import { describeAvailability, monthsFromWeeks } from "./openingsNarrative";
import { dayBefore } from "./sessionWeeks";
import { weeklyCalendar } from "./testCalendar";
import { isSafeOpening, weekCapacities } from "./weekCapacity";
import { monthLabel } from "./monthLabel";

// Upcoming Openings, read the way Leif reads it.
//
// This screen passed every arithmetic test it had and still failed human
// acceptance. The review was not "the number is wrong"; it was "I don't
// understand if I have any openings available or not, what unknown means,
// what 11 out of 12 means, or whether peak 14 means I have 14 people
// enrolled."
//
// So these assert the thing that broke: whether the words on the page
// answer the question. They are deliberately about SENTENCES rather than
// about state — a test that checks `availability.kind === "cannot_calculate"`
// would have passed on the screen Leif rejected.
//
// Every fixture below is synthetic and deterministic. Leif is editing Year
// Tracking while this is written, so nothing here is a snapshot of
// production availability.

const MAX = 12;
const TODAY = new Date("2026-10-01T00:00:00Z");

const enrollment = (
  id: number,
  name: string,
  startDate: string,
): SlotEnrollment => ({
  id,
  status: "active",
  start_date: startDate,
  end_date: null,
  start_date_source: "owner",
  contactId: id,
  name,
});

// The calendar runs weekly from 5 January 2026, so week N is a date these
// fixtures can name exactly. Week 38 (28 September) is the last one that
// begins before "today"; week 44 is 9 November.
const CALENDAR_FROM = "2026-01-05";
const weekStart = (index: number) => {
  const date = new Date(`${CALENDAR_FROM}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + index * 7);
  return date.toISOString().slice(0, 10);
};

// `totalWeeks` is where Year Tracking stops, which is the one knob every
// case below turns: 51 weeks leaves two testable candidate weeks and then
// runs out, 49 leaves none, 68 leaves plenty.
const build = (enrollments: SlotEnrollment[], totalWeeks: number) => {
  const weeks = weeklyCalendar(CALENDAR_FROM, totalWeeks);
  const capacity = computeIndividualCapacity(enrollments, MAX, weeks, TODAY);
  return {
    capacity,
    futureOpenings: computeFutureOpenings(capacity, TODAY),
    weeks,
  };
};

const renderSection = async (
  enrollments: SlotEnrollment[],
  totalWeeks: number,
) => {
  const { capacity, futureOpenings } = build(enrollments, totalWeeks);
  const dataProvider = createDataProvider({
    db: createCrmDb({}),
    silent: true,
    latency: 0,
  });
  const screen = await render(
    <CoreAdminContext
      dataProvider={dataProvider}
      authProvider={createTestAuthProvider()}
      i18nProvider={testI18nProvider}
      store={memoryStore()}
    >
      <UpcomingOpeningsSection
        capacity={capacity}
        futureOpenings={futureOpenings}
        now={TODAY}
      />
    </CoreAdminContext>,
  );
  return { screen, capacity, futureOpenings };
};

const textOf = (screen: { container: Element }) =>
  screen.container.ownerDocument.body.textContent ?? "";

// Twelve clients who started in week 30 and therefore finish in late
// October — a practice that genuinely frees up inside the horizon.
const twelveFinishingSoon = () =>
  Array.from({ length: 12 }, (_, i) =>
    enrollment(i + 1, `Current ${i + 1}`, weekStart(30)),
  );

// Twelve who started in the week before today. Their twelve weeks run to
// the end of a 51-week calendar, so nothing frees while it can still be
// checked.
const twelveStayingPut = () =>
  Array.from({ length: 12 }, (_, i) =>
    enrollment(i + 1, `Current ${i + 1}`, weekStart(38)),
  );

describe("Upcoming Openings answers the question first", () => {
  it("says a new client can start, and which week", async () => {
    // Twelve people who finish in late October, and nobody booked to
    // arrive after them.
    const { screen } = await renderSection(twelveFinishingSoon(), 68);

    const text = textOf(screen);
    // The WEEK leads, the count qualifies it. It was the other way
    // round and Leif said the useful half was the one being whispered.
    const nextOpening = text.slice(text.indexOf("Next opening"));
    const weekAt = nextOpening.indexOf("Week of");
    const countAt = nextOpening.indexOf("can start");
    expect(weekAt).toBeGreaterThanOrEqual(0);
    expect(countAt).toBeGreaterThan(weekAt);
    // The answer, not the mechanism.
    expect(text).not.toContain("Peak");
  });

  it("says it cannot calculate yet, why, and what to do — never 'no openings'", async () => {
    // Eleven future weeks: one short of the twelve a new client needs.
    // This is the exact state Leif saw as "unknown — only 11 of 12
    // session weeks exist for a new client".
    const { screen } = await renderSection(twelveFinishingSoon(), 49);

    const text = textOf(screen);
    expect(text).toContain("Can't calculate yet");
    // WHY, in his terms.
    expect(text).toContain("not far enough to see a full 12-session");
    // ACTION.
    expect(text).toContain("Add more 1:1 weeks to Year Tracking");
    // And the thing it must never say: an absence of calendar is not an
    // absence of openings.
    expect(text).not.toContain("0 safe openings");
    expect(text).not.toContain("No opening yet");
  });

  it("says no opening when the practice is genuinely full", async () => {
    // Twelve who do not free a slot while the calendar can still be
    // checked. The practice is full, which is a different sentence from
    // "I cannot tell" and has to read as one.
    const { screen } = await renderSection(twelveStayingPut(), 51);

    const text = textOf(screen);
    expect(text).toContain("No opening yet");
    expect(text).toContain("keep the programme at capacity through");
    expect(text).not.toContain("Can't calculate your next opening yet");
  });

  it("distinguishes a temporary weekly gap from a sellable opening", async () => {
    // Eleven current clients, and one person already booked to start in
    // week 44. There IS room right now — only eleven people are in the
    // programme — and it is NOT an opening: a new twelve-week client
    // would still be here when the twelfth arrives.
    const holders = [
      ...Array.from({ length: 11 }, (_, i) =>
        enrollment(i + 1, `Current ${i + 1}`, weekStart(38)),
      ),
      enrollment(99, "Booked Later", weekStart(44)),
    ];
    const { screen, capacity } = await renderSection(holders, 51);

    // The gap is real: only eleven people are in the programme today.
    expect(capacity.active).toBe(11);
    expect(capacity.committed).toHaveLength(1);

    // And the answer is still no, because the ceiling has to hold for the
    // whole of a new client's own twelve weeks.
    const text = textOf(screen);
    expect(text).toContain("No opening yet");
    expect(text).not.toContain("can start");
  });
});

describe("Upcoming Openings shows its working", () => {
  it("shows current and committed as two numbers, never added together", async () => {
    // Twelve now plus six booked is not eighteen active. Presenting it as
    // one number is how this board first lied.
    const holders = [
      ...Array.from({ length: 12 }, (_, i) =>
        enrollment(i + 1, `Current ${i + 1}`, weekStart(38)),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        enrollment(20 + i, `Booked ${i + 1}`, weekStart(44)),
      ),
    ];
    const { screen } = await renderSection(holders, 60);

    const text = textOf(screen);
    expect(text).toContain("12 active");
    expect(text).toContain("6 committed to start");
    expect(text).not.toContain("18 active clients out of");
  });

  it("names the over-capacity weeks with their ceiling, not as a bare peak", async () => {
    const holders = [
      ...Array.from({ length: 12 }, (_, i) =>
        enrollment(i + 1, `Current ${i + 1}`, weekStart(38)),
      ),
      enrollment(20, "Ava Frotton", weekStart(44)),
      enrollment(21, "Denise Cormier", weekStart(44)),
    ];
    const { screen } = await renderSection(holders, 60);

    // Over capacity is never hidden — but it lives in the breakdown now.
    // On the card it was one more number among five and made a list of
    // months unreadable.
    expect(textOf(screen)).not.toContain("Peak 14");
    await screen
      .getByRole("button", { name: /November 2026/ })
      .first()
      .click();
    await expect.element(screen.getByRole("dialog")).toBeVisible();

    const text = textOf(screen);
    expect(text).toContain("14 active");
    expect(text).toContain("capacity 12");
    expect(text).toContain("2 over");
  });

  it("keeps the month card to the four things it should answer", async () => {
    const holders = [
      ...Array.from({ length: 12 }, (_, i) =>
        enrollment(i + 1, `Current ${i + 1}`, weekStart(38)),
      ),
      enrollment(20, "Ava Frotton", weekStart(44)),
      enrollment(21, "Denise Cormier", weekStart(44)),
    ];
    const { screen } = await renderSection(holders, 60);

    const card = await screen
      .getByRole("button", { name: /November 2026/ })
      .first()
      .element();
    const text = card.textContent ?? "";

    // Is there an opening, what changes capacity, and where to look.
    expect(text).toMatch(/opening|calculate/i);
    expect(text).toContain("starting");
    expect(text).toContain("finishing");
    expect(text).toContain("View breakdown");

    // And none of what belongs in the breakdown.
    expect(text).not.toContain("Busiest week");
    expect(text).not.toContain("capacity 12");
    expect(text).not.toContain("Peak");
    expect(text).not.toContain("Ava Frotton");
    // A card speaks for its own month, never for the whole forecast.
    expect(text).not.toContain("No opening yet");
  });

  it("opens a month and lists who starts and finishes, by name", async () => {
    const holders = [
      ...Array.from({ length: 11 }, (_, i) =>
        enrollment(i + 1, `Current ${i + 1}`, weekStart(38)),
      ),
      enrollment(20, "Ava Frotton", weekStart(44)),
      enrollment(21, "Denise Cormier", weekStart(44)),
    ];
    const { screen } = await renderSection(holders, 60);

    await screen
      .getByRole("button", { name: /November 2026/ })
      .first()
      .click();

    await expect.element(screen.getByRole("dialog")).toBeVisible();
    const text = textOf(screen);
    expect(text).toContain("capacity breakdown");
    expect(text).toContain("Week of Nov 9");
    expect(text).toContain("Ava Frotton");
    expect(text).toContain("Denise Cormier");
    expect(text).toContain("Starting");
    expect(text).toContain("Finishing");
  });

  it("explains a refused start using the people who cause it", async () => {
    const holders = [
      ...Array.from({ length: 11 }, (_, i) =>
        enrollment(i + 1, `Current ${i + 1}`, weekStart(38)),
      ),
      enrollment(20, "Ava Frotton", weekStart(44)),
      enrollment(21, "Denise Cormier", weekStart(44)),
    ];
    const { screen } = await renderSection(holders, 60);

    await screen
      .getByRole("button", { name: /October 2026/ })
      .first()
      .click();

    await expect.element(screen.getByRole("dialog")).toBeVisible();
    const text = textOf(screen);
    // Not "peak 13". The names of the commitments that make it 13.
    expect(text).toContain("start then");
    expect(text).toContain("Ava Frotton");
  });

  it("shows how far short the calendar is, rather than only that it is", async () => {
    const { screen } = await renderSection(twelveFinishingSoon(), 49);

    await screen
      .getByRole("button", { name: /October 2026/ })
      .first()
      .click();

    await expect.element(screen.getByRole("dialog")).toBeVisible();
    const text = textOf(screen);
    expect(text).toContain("session weeks");
    expect(text).toContain("Add");
    expect(text).toContain("Year Tracking");
  });

  it("never prints the answer object where a count belongs", async () => {
    const { screen } = await renderSection(twelveFinishingSoon(), 49);
    expect(textOf(screen)).not.toContain("[object Object]");
  });

  it("stays legible and operable on a phone", async () => {
    await page.viewport(375, 812);
    const holders = [
      ...Array.from({ length: 11 }, (_, i) =>
        enrollment(i + 1, `Current ${i + 1}`, weekStart(38)),
      ),
      enrollment(20, "Ava Frotton", weekStart(44)),
    ];
    const { screen } = await renderSection(holders, 60);

    // The card is a real button, so it is reachable without a mouse.
    const card = screen.getByRole("button", { name: /November 2026/ }).first();
    await expect.element(card).toBeVisible();
    await card.click();

    await expect.element(screen.getByRole("dialog")).toBeVisible();
    // The weekly breakdown is a stacked list at this width, not a table
    // squeezed sideways.
    expect(textOf(screen)).toContain("Week of");
    // And the page itself never scrolls horizontally.
    const doc = screen.container.ownerDocument;
    expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(
      doc.documentElement.clientWidth + 1,
    );
    await page.viewport(1280, 900);
  });
});

describe("one source of capacity truth", () => {
  it("the headline, the month card and the drilldown are one evaluation", async () => {
    // Not "they agree today". They are produced by the same call: a month
    // card's answer IS describeAvailability over that month's weeks, and
    // the dialog renders the identical object. Proven by computing them
    // here the way the component does and finding no second path.
    const holders = [
      ...Array.from({ length: 11 }, (_, i) =>
        enrollment(i + 1, `Current ${i + 1}`, weekStart(38)),
      ),
      enrollment(20, "Ava Frotton", weekStart(44)),
    ];
    const { capacity } = build(holders, 60);

    const weeks = weekCapacities(capacity, TODAY);
    const horizon = capacity.calendarHorizon
      ? dayBefore(capacity.calendarHorizon)
      : null;
    const headline = describeAvailability(weeks, horizon);
    const months = monthsFromWeeks(weeks, horizon);

    // Every week the months carry is one of the weeks the headline read.
    const fromMonths = months.flatMap((month) => month.weeks);
    expect(fromMonths).toHaveLength(weeks.length);
    for (const week of fromMonths) expect(weeks).toContain(week);

    // And the headline's answer is the answer of the first month that has
    // one — there is no separate "overall" calculation.
    const firstAnswering = months.find(
      (month) => month.availability.kind === headline.kind,
    );
    expect(firstAnswering).toBeDefined();
  });
});

describe("the breakdown is reachable without a mouse", () => {
  it("opens from the keyboard, names itself, and closes on Escape", async () => {
    // Leif asked to be able to click a month. A div with an onClick is
    // not clickable by a keyboard or announceable by a screen reader, so
    // the card is a real button and the breakdown is a real dialog.
    const holders = [
      ...Array.from({ length: 11 }, (_, i) =>
        enrollment(i + 1, `Current ${i + 1}`, weekStart(38)),
      ),
      enrollment(20, "Ava Frotton", weekStart(44)),
    ];
    const { screen } = await renderSection(holders, 60);

    const card = screen.getByRole("button", { name: /November 2026/ }).first();
    const element = (await card.element()) as HTMLButtonElement;
    element.focus();
    expect(screen.container.ownerDocument.activeElement).toBe(element);

    // Enter, the way a keyboard activates a button.
    element.click();

    const dialog = screen.getByRole("dialog");
    await expect.element(dialog).toBeVisible();
    // It says which month it is about, so it is announced as more than
    // "dialog".
    await expect
      .element(screen.getByText(/November 2026 — capacity breakdown/))
      .toBeVisible();

    await userEvent.keyboard("{Escape}");
    await expect
      .poll(() =>
        screen.container.ownerDocument.querySelector('[role="dialog"]'),
      )
      .toBeNull();
  });
});

// The week somebody finishes in is still a week they are in.
//
// Leif found this by reading three surfaces against each other. Production
// said, at the same moment:
//
//   NEXT OPENING          Earliest safe start: week of Nov 29
//   Week of Nov 29        11 active · No finishes
//   Erik Amundson         expected final session week Nov 29, 2026
//   Sarah Monast          expected final session week Nov 29, 2026
//
// Two people were having their twelfth session in a week the drilldown
// said nobody was finishing in. The arithmetic was right — they were
// counted in the 11, and a twelfth client genuinely fits — but the
// drilldown could not show it, because a finish was bucketed by the date
// the slot is RELEASED (`freesOn`, the day after the final week ends)
// rather than by the week the final session is in. Year Tracking has gaps
// between weeks, so that date usually fell into no week at all and
// "Finishing" was empty on every single week.
//
// Shape reproduced exactly: twelve active, two of them finishing in week
// X, four committed arriving before it, capacity twelve.
describe("a client occupies their slot through their final session week", () => {
  const FINAL_WEEK = weekStart(44);
  const NEXT_WEEK = weekStart(45);

  // Ten who run well past the horizon, plus two whose twelfth session is
  // in week 44 — the shape of Erik and Sarah.
  const population = () => [
    ...Array.from({ length: 10 }, (_, i) =>
      enrollment(i + 1, `Stays ${i + 1}`, weekStart(40)),
    ),
    enrollment(20, "Erik Amundson", weekStart(33)),
    enrollment(21, "Sarah Monast", weekStart(33)),
  ];

  const evaluate = () => {
    const { capacity } = build(population(), 70);
    return weekCapacities(capacity, TODAY);
  };

  it("counts them in the week their twelfth session falls in", () => {
    const weeks = evaluate();
    const final = weeks.find((week) => week.week.start === FINAL_WEEK)!;
    const after = weeks.find((week) => week.week.start === NEXT_WEEK)!;

    // Erik and Sarah's twelfth session is in week 44, so they are still
    // two of the twelve that week — and gone the week after.
    expect(final.occupancy).toBe(12);
    expect(after.occupancy).toBe(10);
  });

  it("names them under Finishing in that same week, and in no other", () => {
    const weeks = evaluate();
    const names = (week: (typeof weeks)[number]) =>
      week.finishing.map((holder) => holder.name).sort();

    expect(names(weeks.find((w) => w.week.start === FINAL_WEEK)!)).toEqual([
      "Erik Amundson",
      "Sarah Monast",
    ]);
    // Not the week after, where the release DATE falls.
    expect(names(weeks.find((w) => w.week.start === NEXT_WEEK)!)).toEqual([]);
    // And exactly once across the whole forecast — the old bucketing lost
    // them entirely, which is the failure mode this guards.
    const everyFinish = weeks.flatMap(names);
    expect(everyFinish.filter((n) => n === "Erik Amundson")).toHaveLength(1);
  });

  it("agrees with what the client card says their final session week is", () => {
    const { capacity } = build(population(), 70);
    const erik = capacity.occupied.find((h) => h.name === "Erik Amundson")!;

    // The card renders end.finalWeek.start. The drilldown buckets by the
    // last day occupied. These are two views of one week, and this is the
    // assertion that keeps them that way.
    expect(erik.end?.status).toBe("known");
    if (erik.end?.status !== "known") throw new Error("unreachable");
    expect(erik.end.finalWeek.start).toBe(FINAL_WEEK);
    // The slot is released the day AFTER that week ends — never shown as
    // a week, because it is not one.
    expect(erik.end.freesOn).toBe(erik.end.finalWeek.end);
    expect(erik.end.lastDay < erik.end.freesOn).toBe(true);
  });

  it("still lets a twelfth client start in that week, and says so everywhere", async () => {
    const weeks = evaluate();
    const final = weeks.find((week) => week.week.start === FINAL_WEEK)!;
    const horizon = dayBefore(
      build(population(), 70).capacity.calendarHorizon!,
    );

    // Twelve active including the two finishing, a ceiling of twelve — so
    // no room. The answer Leif saw said there WAS room because only
    // eleven were present; here twelve are, and the answer must be no.
    expect(final.safeStart.answer).toMatchObject({
      status: "known",
      openings: 0,
    });

    // The week after, when their slots are free, is the opening — and the
    // headline, the month and the week all name that same week.
    const after = weeks.find((week) => week.week.start === NEXT_WEEK)!;
    expect(after.safeStart.answer).toMatchObject({ status: "known" });
    expect(isSafeOpening(after)).toBe(true);

    const headline = describeAvailability(weeks, horizon);
    expect(headline.kind).toBe("safe_opening");
    if (headline.kind !== "safe_opening") throw new Error("unreachable");
    expect(headline.week.week.start).toBe(NEXT_WEEK);

    const months = monthsFromWeeks(weeks, horizon);
    const month = months.find((m) => m.month === NEXT_WEEK.slice(0, 7))!;
    expect(month.availability.kind).toBe("safe_opening");
  });

  it("tells Leif when the finishing slots actually free up", async () => {
    const { capacity, futureOpenings } = build(population(), 70);
    const dataProvider = createDataProvider({
      db: createCrmDb({}),
      silent: true,
      latency: 0,
    });
    const screen = await render(
      <CoreAdminContext
        dataProvider={dataProvider}
        authProvider={createTestAuthProvider()}
        i18nProvider={testI18nProvider}
        store={memoryStore()}
      >
        <UpcomingOpeningsSection
          capacity={capacity}
          futureOpenings={futureOpenings}
          now={TODAY}
        />
      </CoreAdminContext>,
    );

    const month = monthLabel(FINAL_WEEK.slice(0, 7));
    await screen
      .getByRole("button", { name: new RegExp(month) })
      .first()
      .click();
    await expect.element(screen.getByRole("dialog")).toBeVisible();

    const text = textOf(screen);
    expect(text).toContain("Erik Amundson");
    expect(text).toContain("Sarah Monast");
    // "Finishing" and "free" are a week apart, and the drilldown says so
    // rather than leaving Leif to work it out.
    expect(text).toContain("free from the week of");
  });
});
