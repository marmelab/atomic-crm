import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { MemoryRouter, Route, Routes } from "react-router";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb } from "@/test/StoryWrapper";
import type { Cohort, Offer } from "../types";
import { createDataProviderPublicApplicationDataSource } from "./publicApplicationDataSource";
import { LivingExampleApplicationPage } from "./LivingExampleApplicationPage";
import { GrowingYourselfUpApplicationPage } from "./GrowingYourselfUpApplicationPage";

// Real LE + GYU Application Forms slice, Phase 8 — proves the real
// questionnaire content (not the FakeRest/dev domain logic, already
// covered by submitApplication.test.ts) actually renders: the right
// question set per offer, nothing from the other offer's set, and the
// structured identity fields required by Phase 2. Updated for
// human-acceptance round 1's corrections (title, copy, no Phone field,
// italic "now", larger question typography).

const LE_OFFER_ID = 1;
const GYU_OFFER_ID = 2;
const COHORT_ID = 1;

const livingExample: Offer = {
  id: LE_OFFER_ID,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  max_active_clients: 5,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const growingYourselfUp: Offer = {
  id: GYU_OFFER_ID,
  name: "Growing Yourself Up",
  type: "group",
  duration: "8 weeks",
  current_price: 1400,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const openCohort: Cohort = {
  id: COHORT_ID,
  offer_id: GYU_OFFER_ID,
  name: "September Cohort",
  status: "applications_open",
  applications_open_at: "2026-08-01",
  applications_close_at: "2026-12-31",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildDataSource = () => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [],
      offers: [livingExample, growingYourselfUp],
      offer_payment_options: [],
      cohorts: [openCohort],
      deals: [],
      applications: [],
      enrollments: [],
      tasks: [],
      waitlist_entries: [],
    } as any),
    silent: true,
    latency: 0,
  });
  return createDataProviderPublicApplicationDataSource(dataProvider);
};

describe("LivingExampleApplicationPage — Apply to Chat with Leif content", () => {
  it("shows the real title/intro and exactly the five real questions, each required, with no Phone field", async () => {
    const dataSource = buildDataSource();
    const screen = await render(
      <MemoryRouter initialEntries={["/apply/living-example"]}>
        <LivingExampleApplicationPage dataSource={dataSource} />
      </MemoryRouter>,
    );

    await expect
      .element(screen.getByRole("heading", { name: "Apply to Chat with Leif" }))
      .toBeInTheDocument();
    // The intro is one paragraph: a plain instruction, then an italicised
    // promise about what happens next. Asserted as separate nodes because
    // only the second is wrapped in <em>.
    await expect
      .element(
        screen.getByText("Take your time and answer as honestly as you can."),
      )
      .toBeInTheDocument();
    const promise = screen.getByText(
      "If it looks like I can help, I’ll invite you to book a free 30-minute chat so we can explore working together.",
    );
    await expect.element(promise).toBeInTheDocument();
    // Italic, and only here.
    expect(promise.element().tagName).toBe("EM");

    // An applicant has not chosen a programme yet, so the page names none.
    const intro = screen.container.textContent ?? "";
    expect(intro).not.toContain("The Living Example");
    expect(intro).not.toContain("4-month");

    // Identity fields: structured, required, and no Phone field anywhere
    // (round 1: "Leif does not want a phone-number field on either
    // application").
    for (const label of ["First Name", "Last Name", "Email"]) {
      const field = screen.getByLabelText(new RegExp(`^${label}`));
      await expect.element(field).toBeInTheDocument();
    }
    await expect
      .element(screen.getByLabelText(/Phone/))
      .not.toBeInTheDocument();

    const leQuestions = [
      "What's the main pattern, emotion, or relationship dynamic you're struggling with right now?",
      "What have you already tried to change or shift this?",
      "How are you hoping to change through working together?",
      "How are you hoping I will support you?",
      "On a scale of 1–10, how committed are you to changing this pattern/way-of-being?",
    ];
    for (const question of leQuestions) {
      await expect
        .element(screen.getByText(question, { exact: false }))
        .toBeInTheDocument();
    }

    // Human-acceptance round 4: Leif doesn't want Q5 constrained to a
    // number-feeling single-line field — applicants may answer things
    // like "10 — but I'm scared of the money!" and need room for context.
    // Proven two ways: (1) it's a real <textarea>, not a single-line
    // <input>, and (2) it actually accepts and displays that exact text.
    const commitmentField = screen.getByLabelText(/^On a scale of 1–10/);
    expect((commitmentField.element() as HTMLElement).tagName).toBe("TEXTAREA");
    await commitmentField.fill("10 — but I’m scared of the money!");
    await expect
      .element(commitmentField)
      .toHaveValue("10 — but I’m scared of the money!");

    // Helper text corrected in round 1: "meditation", not "mediation".
    await expect
      .element(
        screen.getByText(
          "(Working with a therapist, meditation, personal work, etc.)",
        ),
      )
      .toBeInTheDocument();

    // The old (round-1-superseded) title and Question 4 wording are gone.
    await expect
      .element(screen.getByRole("heading", { name: "Pre-Call Questionnaire" }))
      .not.toBeInTheDocument();
    await expect
      .element(
        screen.getByText(
          "What are you hoping I will support you in this process?",
        ),
      )
      .not.toBeInTheDocument();

    // None of the Growing Yourself Up questions leak into this page.
    await expect
      .element(
        screen.getByText("Why are you ready for support and change now?"),
      )
      .not.toBeInTheDocument();
  });
});

describe("GrowingYourselfUpApplicationPage — real Application content", () => {
  it("shows the real title/intro and exactly the four real questions, each required, with no Phone field, copy corrected per round 1", async () => {
    const dataSource = buildDataSource();
    const screen = await render(
      <MemoryRouter
        initialEntries={[`/apply/growing-yourself-up/${COHORT_ID}`]}
      >
        <Routes>
          <Route
            path="/apply/growing-yourself-up/:cohortId"
            element={
              <GrowingYourselfUpApplicationPage dataSource={dataSource} />
            }
          />
        </Routes>
      </MemoryRouter>,
    );

    await expect
      .element(
        screen.getByRole("heading", {
          name: "Growing Yourself Up Application",
        }),
      )
      .toBeInTheDocument();
    await expect
      .element(
        screen.getByText("Take your time and answer as honestly as you can."),
      )
      .toBeInTheDocument();
    await expect
      .element(
        screen.getByText(
          "This helps me get a sense of where you’re looking for support and if Growing Yourself Up is the right fit!",
        ),
      )
      .toBeInTheDocument();

    for (const label of ["First Name", "Last Name", "Email"]) {
      const field = screen.getByLabelText(new RegExp(`^${label}`));
      await expect.element(field).toBeInTheDocument();
    }
    await expect
      .element(screen.getByLabelText(/Phone/))
      .not.toBeInTheDocument();

    // Copy corrected per round 1: "you're facing" (not "your facing"),
    // "this program with Leif" (not "with program with Leif"), en dash
    // "1–10" (not hyphen "1-10").
    const gyuQuestions = [
      "What's the biggest challenge you're facing in your personal growth and healing?",
      "Why are you ready for support and change now?",
      "What are you hoping this program with Leif helps you create in your life and relationships?",
      "On a scale from 1–10, how ready are you to make a time, financial, and personal commitment to the change you want?",
    ];
    for (const question of gyuQuestions) {
      await expect
        .element(screen.getByText(question, { exact: false }))
        .toBeInTheDocument();
    }

    // Final human-acceptance tweak: same free-text treatment as LE's
    // commitment question — a real <textarea>, not a single-line <input>,
    // and it actually accepts contextual text with punctuation/Unicode.
    const gyuCommitmentField = screen.getByLabelText(/^On a scale from 1–10/);
    expect((gyuCommitmentField.element() as HTMLElement).tagName).toBe(
      "TEXTAREA",
    );
    await gyuCommitmentField.fill(
      "8 — I’m ready, but finances are the concern.",
    );
    await expect
      .element(gyuCommitmentField)
      .toHaveValue("8 — I’m ready, but finances are the concern.");

    // "now" renders as its own italic (<em>) element within Question 2 —
    // proven semantically (a real <em> element with that exact text),
    // not via raw HTML injection.
    const nowEl = screen.getByText("now", { exact: true });
    await expect.element(nowEl).toBeInTheDocument();
    expect((nowEl.element() as HTMLElement).tagName).toBe("EM");

    // The old (round-1-superseded) wording is gone.
    await expect
      .element(
        screen.getByText(
          "What's the biggest challenge your facing in your personal growth and healing?",
        ),
      )
      .not.toBeInTheDocument();
    await expect
      .element(
        screen.getByText(
          "What are you hoping with program with Leif helps you create in your life and relationships?",
        ),
      )
      .not.toBeInTheDocument();

    // None of the Living Example questions leak into this page.
    await expect
      .element(
        screen.getByText(
          "What have you already tried to change or shift this?",
        ),
      )
      .not.toBeInTheDocument();
  });
});
