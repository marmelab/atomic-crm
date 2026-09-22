import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { CoreAdminContext, Form, memoryStore } from "ra-core";

import { testI18nProvider } from "../providers/commons/i18nProvider";
import { createDataProvider } from "../providers/fakerest";
import { createCrmDb, createTestAuthProvider } from "@/test/StoryWrapper";
import { useWatch } from "react-hook-form";
import { CohortScheduleInputs } from "./CohortScheduleInputs";

// The form VALUE, rendered so a test can read it. This is what a save
// would carry; DateInput deliberately remounts itself when the value
// changes from outside, so reading its DOM value tests the widget rather
// than the rule.
const EndValueProbe = () => {
  const value = useWatch({ name: "program_end_at" });
  return <span data-testid="end-value">{String(value ?? "")}</span>;
};

// Same reasoning for the duration's unit, and a sharper one: the dropdown
// showed "weeks" while the form held nothing at all, so only the value can
// say whether the two agree.
const UnitValueProbe = () => {
  const value = useWatch({ name: "duration_unit" });
  return <span data-testid="unit-value">{String(value ?? "")}</span>;
};

// The end date has to behave the way a person expects a calculated field
// to: it follows the inputs until you overrule it, and then it is yours.
//
// These mount the real inputs and drive them, because the rule is about
// what happens when fields change — something a pure function cannot be
// asked.

// Captures what a save would write. The end date is a form VALUE before
// it is anything on screen, and what gets persisted is the guarantee that
// matters — DateInput deliberately remounts itself when the value changes
// from outside, so reading its DOM value tests the widget rather than the
// rule.
const mountForm = async (
  record: Record<string, unknown>,
  submitted?: { current: Record<string, unknown> | null },
) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({} as never),
    silent: true,
    latency: 0,
  });
  return render(
    <CoreAdminContext
      dataProvider={dataProvider}
      authProvider={createTestAuthProvider()}
      i18nProvider={testI18nProvider}
      store={memoryStore()}
    >
      <Form
        record={record}
        onSubmit={(values: Record<string, unknown>) => {
          if (submitted) submitted.current = values;
        }}
      >
        <CohortScheduleInputs />
        <EndValueProbe />
        <UnitValueProbe />
      </Form>
    </CoreAdminContext>,
  );
};

// DateInput renders no name attribute on the DOM node, so the fields are
// reached the way a person reaches them: by their label.
type Screen = Awaited<ReturnType<typeof mountForm>>;
const valueOf = async (screen: Screen, label: RegExp) =>
  ((await screen.getByLabelText(label).element()) as HTMLInputElement).value;
const endField = (screen: Screen) => valueOf(screen, /Program end/i);
const unitValue = async (screen: Screen) =>
  screen.container.ownerDocument.querySelector('[data-testid="unit-value"]')
    ?.textContent ?? "";
const startField = (screen: Screen) => valueOf(screen, /Program start/i);

describe("a group round's end date", () => {
  it("calculates from the start date and duration, and saves it", async () => {
    // Fall 2026: 22 September plus 8 weeks is 10 November. Eight weeks
    // means eight weekly sessions, so the last begins seven weeks after
    // the first — never 17 November.
    const submitted = { current: null as Record<string, unknown> | null };
    const screen = await mountForm(
      {
        program_start_at: "2026-09-22",
        duration_value: 8,
        duration_unit: "weeks",
        program_end_at: null,
      },
      submitted,
    );

    await expect
      .element(screen.getByText("Calculated from the start date and duration."))
      .toBeVisible();

    await expect
      .poll(
        () =>
          screen.container.ownerDocument.querySelector(
            '[data-testid="end-value"]',
          )?.textContent,
      )
      .toBe("2026-11-10");
  });

  it("moves when the start date moves", async () => {
    const screen = await mountForm({
      program_start_at: "2026-09-22",
      duration_value: 8,
      duration_unit: "weeks",
      program_end_at: "2026-11-10",
    });
    await expect.poll(() => endField(screen)).toBe("2026-11-10");

    await screen.getByLabelText(/Program start/i).fill("2026-09-29");

    await expect.poll(() => endField(screen)).toBe("2026-11-17");
  });

  it("moves when the duration changes", async () => {
    const screen = await mountForm({
      program_start_at: "2026-09-22",
      duration_value: 8,
      duration_unit: "weeks",
      program_end_at: "2026-11-10",
    });
    await expect.poll(() => endField(screen)).toBe("2026-11-10");

    await screen.getByLabelText(/Duration/i).fill("10");

    await expect.poll(() => endField(screen)).toBe("2026-11-24");
  });

  it("stops recalculating once Leif sets the end himself", async () => {
    // A round that overran, or took a week off in the middle, is a fact
    // about that round. Nothing may quietly correct it back to the
    // formula.
    const screen = await mountForm({
      program_start_at: "2026-09-22",
      duration_value: 8,
      duration_unit: "weeks",
      program_end_at: "2026-11-10",
    });
    await expect.poll(() => endField(screen)).toBe("2026-11-10");

    await screen.getByLabelText(/Program end/i).fill("2026-11-24");
    await expect
      .element(
        screen.getByText("You set this end date, so it stays as you left it."),
      )
      .toBeVisible();

    // Now move the start. His date must survive it.
    await screen.getByLabelText(/Program start/i).fill("2026-09-29");
    await expect.poll(() => startField(screen)).toBe("2026-09-29");
    expect(await endField(screen)).toBe("2026-11-24");
  });

  it("offers a visible way back to automatic", async () => {
    // A field that silently stops updating with no way to restart it is
    // worse than one that never updated.
    const screen = await mountForm({
      program_start_at: "2026-09-22",
      duration_value: 8,
      duration_unit: "weeks",
      program_end_at: "2027-01-05",
    });

    await screen.getByRole("button", { name: "Recalculate" }).click();

    await expect.poll(() => endField(screen)).toBe("2026-11-10");
    await expect
      .element(screen.getByText("Calculated from the start date and duration."))
      .toBeVisible();
  });

  it("calculates nothing when there is no duration to calculate from", async () => {
    // January 2027: fifty-one people waiting, nothing scheduled. The form
    // lets Leif enter it and invents none of it.
    const screen = await mountForm({
      program_start_at: null,
      duration_value: null,
      duration_unit: null,
      program_end_at: null,
    });

    expect(await endField(screen)).toBe("");
    expect(screen.container.ownerDocument.body.textContent).not.toContain(
      "Calculated from the start date and duration.",
    );
  });
});

describe("a group round's duration", () => {
  it("derives the end date from a round typed in from scratch", async () => {
    // The whole thing entered by hand, which is how a NEW round starts —
    // and how this broke. The Unit dropdown showed "weeks" while the form
    // held nothing, so the end date silently stayed empty and the round
    // would have been refused on save by a constraint naming a field Leif
    // could see was already set.
    const submitted = { current: null as Record<string, unknown> | null };
    const screen = await mountForm({}, submitted);

    await screen.getByLabelText(/Program start/i).fill("2026-09-22");
    await screen.getByLabelText(/^Duration/i).fill("8");

    await expect
      .poll(
        () =>
          screen.container.ownerDocument.querySelector(
            '[data-testid="end-value"]',
          )?.textContent,
      )
      .toBe("2026-11-10");
  });

  it("keeps the number and the unit together, because the database does", async () => {
    // cohorts_duration_is_complete_check: a round has both or neither.
    // Clearing the number must take the unit with it rather than leaving
    // a "weeks" the round no longer has a length in.
    const screen = await mountForm({});
    await screen.getByLabelText(/^Duration/i).fill("8");
    await expect.poll(async () => await unitValue(screen)).toBe("weeks");

    await screen.getByLabelText(/^Duration/i).fill("");

    await expect.poll(async () => await unitValue(screen)).toBe("");
  });
});
