import type {
  Deal,
  DealPaymentScheduleItem,
  DealStripePlanObject,
  EnrollmentOnboardingItem,
  EnrollmentStatus,
  OnboardingTracking,
} from "../types";
import { assessOnboarding } from "../enrollments/assessOnboarding";
import { assessPaymentTruth, type PaymentTruth } from "./paymentTruth";

// What still has to happen before a sold Opportunity leaves the board.
//
// This is a PIPELINE question, and it is deliberately not the same as the
// client's own onboarding state. Emma Wijns is why: Leif has confirmed she
// is onboarded — contract done, access granted — and her payment plan has
// still never been created. Her client onboarding is complete; her
// post-sale setup is not. Collapsing the two would either call her
// un-onboarded (false, and it would overwrite owner-confirmed truth) or
// drop her off the board with a real job outstanding.
//
// So: four dimensions stay four. Sales outcome is Won the moment they say
// yes and never moves again. This answers only "is there still setup work
// keeping this on the active board?"
export type PostSaleBlocker = {
  kind: "payment" | "onboarding";
  // What Leif reads on the card. Short, operational, no jargon.
  label: string;
};

export type PostSaleSetup = {
  complete: boolean;
  blockers: PostSaleBlocker[];
  // The single line the Kanban card shows. Null once nothing is left.
  headline: string | null;
  payment: PaymentTruth;
};

// Payment SETUP is not payment COLLECTION, and it is not "some money once
// arrived" either.
//
// Setup is complete when an ARRANGEMENT EXISTS: the whole amount is in, or
// a live Stripe plan is carrying it, or Leif has confirmed an arrangement
// outside Stripe. A single historical payment with no live plan is not a
// payment arrangement, and neither is a Stripe customer, a saved card or a
// succeeded SetupIntent.
//
// That whole judgement lives in paymentTruth.paymentSetupComplete; this
// module only asks.

// An engagement that has ended is not setup work.
//
// Kerri Fukui, Samantha Putkunz, Nicole Fielding and Sarah McNurlin all
// finished months or years ago and all carry an open payment review about
// historical money. Without this they would sit in the Onboarding column
// forever, next to a client who genuinely needs a plan created — which is
// exactly the "finished clients must not remain in the active Pipeline"
// rule, arriving from the other direction.
const TERMINAL_ENROLLMENT_STATUSES: ReadonlySet<string> = new Set([
  "completed",
  "withdrawn",
  "ended",
]);

export const assessPostSaleSetup = ({
  deal,
  enrollmentStatus,
  enrollmentOnboardingTracking: onboardingTracking,
  scheduleItems,
  planObjects,
  onboardingItems,
}: {
  deal: Deal;
  enrollmentStatus?: EnrollmentStatus | null;
  enrollmentOnboardingTracking?: OnboardingTracking | null;
  scheduleItems: DealPaymentScheduleItem[];
  planObjects: DealStripePlanObject[];
  onboardingItems: EnrollmentOnboardingItem[];
}): PostSaleSetup => {
  if (
    enrollmentStatus != null &&
    TERMINAL_ENROLLMENT_STATUSES.has(enrollmentStatus)
  ) {
    return {
      complete: true,
      blockers: [],
      headline: null,
      payment: assessPaymentTruth({ deal, scheduleItems, planObjects }),
    };
  }

  const blockers: PostSaleBlocker[] = [];

  // Required checklist items that are genuinely outstanding.
  //
  // This used to read an empty checklist as "not tracked here" and move
  // on, which was right for the imported clients and wrong for everyone
  // else — and it was a guess either way, because the rows cannot say
  // which. The Enrollment says it now. A legacy Enrollment contributes no
  // blocker, exactly as before; a TRACKED Enrollment with no checklist is
  // no longer waved through as though it had finished one.
  const onboarding = assessOnboarding({
    tracking: onboardingTracking,
    items: onboardingItems,
  });

  if (onboarding.mode === "tracked") {
    if (onboarding.isMissingChecklist) {
      blockers.push({
        kind: "onboarding",
        label: "Onboarding checklist missing",
      });
    }
    for (const item of onboarding.outstandingRequired) {
      blockers.push({ kind: "onboarding", label: `${item.label} pending` });
    }
  }

  const payment = assessPaymentTruth({ deal, scheduleItems, planObjects });
  if (!payment.paymentSetupComplete) {
    blockers.push({
      kind: "payment",
      label:
        payment.state === "needs_review"
          ? "Payment needs review"
          : "Payment setup pending",
    });
  }

  return {
    complete: blockers.length === 0,
    blockers,
    payment,
    // Payment leads when it is outstanding: it is the one blocker that
    // stops money arriving, and in practice it is the last thing left.
    headline:
      blockers.find((b) => b.kind === "payment")?.label ??
      blockers[0]?.label ??
      null,
  };
};
