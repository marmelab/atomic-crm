import { useParams } from "react-router";

import type { PublicApplicationDataSource } from "./publicApplicationDataSource";
import type { PublicOfferContext } from "./publicOfferContext";
import { PublicApplicationLayout } from "./PublicApplicationLayout";
import { ApplicationUnavailableNotice } from "./ApplicationUnavailableNotice";
import { usePublicOfferContext } from "./usePublicOfferContext";
import {
  PublicApplicationForm,
  type ApplicationQuestion,
} from "./PublicApplicationForm";
import { NotFoundNotice } from "./NotFoundNotice";

// Real Growing Yourself Up Application copy (Real LE + GYU Application
// Forms slice, Phase 4; corrected in human-acceptance round 1). Wording is
// Leif's own; round 1 corrected "your facing" -> "you're facing" and "with
// program with Leif" -> "this program with Leif", and asked for "now" to
// render in italics within Question 2's otherwise-unchanged text (plain
// <em>, not raw HTML — see PublicApplicationForm.tsx's ApplicationQuestion
// type). Keys are prefixed gyu_ so they can never collide with a Living
// Example key (Phase 6: "no collisions between offer question sets") and
// stay stable across round 1's wording corrections — no unnecessary
// answer-key churn.
const QUESTIONS: ApplicationQuestion[] = [
  {
    key: "gyu_biggest_challenge",
    label:
      "What's the biggest challenge you're facing in your personal growth and healing?",
    required: true,
  },
  {
    key: "gyu_why_now",
    label: (
      <>
        Why are you ready for support and change <em>now</em>?
      </>
    ),
    required: true,
  },
  {
    key: "gyu_hoped_outcome",
    label:
      "What are you hoping this program with Leif helps you create in your life and relationships?",
    required: true,
  },
  {
    // Final human-acceptance tweak: the same treatment as LE's
    // le_commitment_scale — no `inputType: "short"`, so this renders as
    // the standard Textarea rather than a single-line field. Leif doesn't
    // want either commitment-scale question to read as numeric-only;
    // applicants may answer "8 — I'm ready, but finances are the
    // concern." and need room for that context. Question wording and key
    // are unchanged.
    key: "gyu_commitment_scale",
    label:
      "On a scale from 1–10, how ready are you to make a time, financial, and personal commitment to the change you want?",
    required: true,
  },
];

// /apply/growing-yourself-up/:cohortId — route-driven Cohort context
// (§2B): a new Cohort never needs a new hardcoded page, only a new row.
// The Cohort's own numeric id is the route param — it isn't sensitive
// (a sequential identifier for an offering, not personal data) and
// reusing it avoids inventing a separate public-slug schema field beyond
// what §1 calls "the smallest durable schema change needed" (none, here).
export const GrowingYourselfUpApplicationPage = ({
  dataSource,
}: {
  dataSource: PublicApplicationDataSource;
}) => {
  const { cohortId } = useParams();
  // A link with no cohort in it is a bad link, not a failure to load —
  // the same "not-found" answer the effect gave before, kept so the page
  // still explains itself rather than offering a pointless retry.
  const state = usePublicOfferContext(() =>
    cohortId
      ? dataSource.getGroupCohortContext(cohortId)
      : Promise.resolve({ kind: "not-found" } as PublicOfferContext),
  );

  // Never an unbounded wait: a failure is a visible, retryable state.
  if (state.status === "loading") return null;
  if (state.status === "failed") {
    return <ApplicationUnavailableNotice onRetry={state.retry} />;
  }
  const context = state.context;

  if (context.kind === "not-found") {
    return (
      <PublicApplicationLayout
        title="Apply"
        orientation="This application isn't available right now."
      >
        <NotFoundNotice />
      </PublicApplicationLayout>
    );
  }

  if (context.kind === "group-closed") {
    return (
      <PublicApplicationLayout
        title={context.offerName}
        orientation={`Applications for this cohort are closed.`}
      >
        <NotFoundNotice message="Applications for this cohort aren't open right now. Please check back later, or reach out if you'd like to be considered for a future cohort." />
      </PublicApplicationLayout>
    );
  }

  if (context.kind !== "group-open") return null;

  return (
    <PublicApplicationLayout
      title="Growing Yourself Up Application"
      orientation={
        <>
          Take your time and answer as honestly as you can.
          <br />
          This helps me get a sense of where you’re looking for support and if
          Growing Yourself Up is the right fit!
        </>
      }
      cover
    >
      <PublicApplicationForm
        questions={QUESTIONS}
        onSubmit={async (values) => {
          const result = await dataSource.submitApplication({
            offerId: context.offerId,
            cohortId: context.cohortId,
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email,
            // Round 1: phone removed entirely — see LivingExampleApplicationPage.tsx's
            // identical comment for why this needs no backend change.
            phone: null,
            answers: values.answers,
          });
          if (result.status === "submitted") return { ok: true };
          if (result.status === "validation-error") {
            return { ok: false, formError: result.message };
          }
          if (result.status === "cohort-closed") {
            return {
              ok: false,
              formError: "Applications for this cohort just closed.",
            };
          }
          return {
            ok: false,
            formError: "This application isn't available right now.",
          };
        }}
      />
    </PublicApplicationLayout>
  );
};

GrowingYourselfUpApplicationPage.path = "/apply/growing-yourself-up/:cohortId";
