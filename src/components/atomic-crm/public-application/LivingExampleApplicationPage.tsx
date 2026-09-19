import type { PublicApplicationDataSource } from "./publicApplicationDataSource";
import { PublicApplicationLayout } from "./PublicApplicationLayout";
import { ApplicationUnavailableNotice } from "./ApplicationUnavailableNotice";
import { usePublicOfferContext } from "./usePublicOfferContext";
import {
  PublicApplicationForm,
  type ApplicationQuestion,
} from "./PublicApplicationForm";
import { NotFoundNotice } from "./NotFoundNotice";

// Real Living Example / "The Living Example Application" copy (Real LE +
// GYU Application Forms slice, Phase 3; corrected in human-acceptance
// round 1). Wording is Leif's own, preserved exactly for his own visual
// review except where he's explicitly corrected it (round 1: "mediation"
// -> "meditation", Question 4 reworded). Keys are prefixed le_ so they can
// never collide with a Growing Yourself Up key even though the two forms'
// raw_answers live in unrelated rows regardless (Phase 6: "no collisions
// between offer question sets"). Keys stay stable across round 1's
// wording corrections — no unnecessary answer-key churn.
const QUESTIONS: ApplicationQuestion[] = [
  {
    key: "le_main_pattern",
    label:
      "What's the main pattern, emotion, or relationship dynamic you're struggling with right now?",
    helperText: "(Be specific—what keeps happening?)",
    required: true,
  },
  {
    key: "le_prior_attempts",
    label: "What have you already tried to change or shift this?",
    helperText: "(Working with a therapist, meditation, personal work, etc.)",
    required: true,
  },
  {
    key: "le_hoped_change",
    label: "How are you hoping to change through working together?",
    helperText: "(Be as real as possible)",
    required: true,
  },
  {
    key: "le_hoped_support",
    label: "How are you hoping I will support you?",
    helperText: "(What does “support” mean to you?)",
    required: true,
  },
  {
    // Human-acceptance round 4: Leif does NOT want this constrained to a
    // numeric-only/single-line-feeling input — applicants may answer
    // "10 — but I'm scared of the money!" and need room for that context.
    // No `inputType: "short"` here (unlike GYU's equivalent scale
    // question) so this renders as the normal Textarea, same as every
    // other LE question — no numeric validation exists anywhere in this
    // form to begin with (the "short" variant was always a plain text
    // Input, never type="number"), so this is purely a UI-affordance
    // change, not a validation change.
    key: "le_commitment_scale",
    label:
      "On a scale of 1–10, how committed are you to changing this pattern/way-of-being?",
    helperText: "(Time commitment, financial commitment, personal commitment)",
    required: true,
  },
];

// /apply/living-example — the native public application form for the
// individual 1:1 Offer (§2A). The Offer is discovered the same way the
// rest of the app already does (no hardcoded id/name — see
// publicOfferContext.ts), so this page keeps working if the Offer is ever
// renamed or recreated.
export const LivingExampleApplicationPage = ({
  dataSource,
}: {
  dataSource: PublicApplicationDataSource;
}) => {
  const state = usePublicOfferContext(() =>
    dataSource.getLivingExampleContext(),
  );

  // Never an unbounded wait: a failure is a visible, retryable state.
  if (state.status === "loading") return null;
  if (state.status === "failed") {
    return <ApplicationUnavailableNotice onRetry={state.retry} />;
  }
  const context = state.context;
  if (context.kind !== "individual") {
    return (
      <PublicApplicationLayout
        title="Apply"
        orientation="This application isn't available right now."
      >
        <NotFoundNotice />
      </PublicApplicationLayout>
    );
  }

  return (
    <PublicApplicationLayout
      // What this page is FOR, from the applicant's side: a conversation,
      // not a purchase. It deliberately names no programme, no duration
      // and no offer — somebody applying has not chosen one yet, and
      // saying otherwise up front asks them to commit before the chat
      // that decides whether there is anything to commit to.
      title="Apply to Chat with Leif"
      orientation={
        <>
          Take your time and answer as honestly as you can.{" "}
          {/* Only this sentence is italicised: it is the promise about
              what happens next, and it reads as an aside to the
              instruction before it. */}
          <em>
            If it looks like I can help, I’ll invite you to book a free
            30-minute chat so we can explore working together.
          </em>
        </>
      }
      cover
    >
      <PublicApplicationForm
        questions={QUESTIONS}
        onSubmit={async (values) => {
          const result = await dataSource.submitApplication({
            offerId: context.offerId,
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email,
            // Round 1: phone removed entirely (Leif doesn't want it on
            // either form). Passed as null, not omitted — matches the
            // existing PublicApplicationInput type (`phone?: string |
            // null`) and the Edge Function/RPC's own existing null-safe
            // handling; no backend change needed since phone was already
            // optional/null-capable end to end.
            phone: null,
            answers: values.answers,
          });
          if (result.status === "submitted") return { ok: true };
          if (result.status === "validation-error") {
            return { ok: false, formError: result.message };
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

LivingExampleApplicationPage.path = "/apply/living-example";
