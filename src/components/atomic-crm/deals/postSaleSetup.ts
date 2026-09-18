import type {
  Deal,
  DealPaymentScheduleItem,
  DealStripePlanObject,
  EnrollmentOnboardingItem,
  EnrollmentStatus,
} from "../types";
import { derivePaymentStatus, type PaymentState } from "./paymentStatus";

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
};

// Payment SETUP is not payment COLLECTION.
//
// A six-month plan that has been created and linked is set up, even though
// five installments are still to come; a client must not sit in Onboarding
// for six months waiting for money that is already arranged. What counts is
// whether the arrangement exists.
//
// owner_confirmed_plan is deliberately absent: those are terms Leif has
// stated with nothing in Stripe behind them yet, which is exactly the
// "still needs creating or linking" case.
export const PAYMENT_SETUP_COMPLETE_STATES: ReadonlySet<PaymentState> = new Set(
  ["paid_in_full", "active_plan", "scheduled_plan"],
);

export const isPaymentSetUp = (state: PaymentState): boolean =>
  PAYMENT_SETUP_COMPLETE_STATES.has(state);

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
  scheduleItems,
  planObjects,
  onboardingItems,
}: {
  deal: Deal;
  enrollmentStatus?: EnrollmentStatus | null;
  scheduleItems: DealPaymentScheduleItem[];
  planObjects: DealStripePlanObject[];
  onboardingItems: EnrollmentOnboardingItem[];
}): PostSaleSetup => {
  if (
    enrollmentStatus != null &&
    TERMINAL_ENROLLMENT_STATUSES.has(enrollmentStatus)
  ) {
    return { complete: true, blockers: [], headline: null };
  }

  const blockers: PostSaleBlocker[] = [];

  // Required checklist items that are genuinely outstanding.
  //
  // An Enrollment with NO item rows at all is a historical import, not a
  // client with everything outstanding — those clients were onboarded long
  // before the checklist existed. Inventing blockers for them would drag
  // years of finished clients back onto the board, so an empty checklist
  // is read as "not tracked here", never as "nothing done".
  const outstanding = onboardingItems.filter(
    (item) => item.is_required && item.status !== "done",
  );
  for (const item of outstanding) {
    blockers.push({ kind: "onboarding", label: `${item.label} pending` });
  }

  const payment = derivePaymentStatus(deal, scheduleItems, planObjects);
  if (!isPaymentSetUp(payment.state)) {
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
    // Payment leads when it is outstanding: it is the one blocker that
    // stops money arriving, and in practice it is the last thing left.
    headline:
      blockers.find((b) => b.kind === "payment")?.label ??
      blockers[0]?.label ??
      null,
  };
};
