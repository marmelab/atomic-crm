import type { EnrollmentOnboardingItem, OnboardingTracking } from "../types";

// The one answer to "how is this client's onboarding going".
//
// Three consumers used to answer it separately from the same checklist
// rows, and an EMPTY checklist made them disagree completely:
//
//   assessPostSaleSetup        no rows -> no blockers -> effectively done
//   computeOnboardingProgress  no rows -> allRequiredComplete false -> not done
//   the DB activation trigger  no incomplete row exists -> activation allowed
//
// Each reading is defensible on its own, which is exactly why none of them
// could be right: the rows do not carry the information. The Enrollment
// does now, so this module reads `onboarding_tracking` and returns a shape
// that makes the legacy case impossible to mistake for either "finished"
// or "nothing done".
//
// Returning a discriminated union rather than a percentage is deliberate.
// A caller cannot accidentally render a legacy Enrollment as 0/0 complete,
// because there is no number on that branch to render.

export type OnboardingAssessment =
  | {
      mode: "tracked";
      requiredItems: EnrollmentOnboardingItem[];
      optionalItems: EnrollmentOnboardingItem[];
      requiredDoneCount: number;
      // Every required item is done. False when there are no required
      // items at all — an empty checklist on a tracked Enrollment is a
      // checklist that went missing, not one that was finished.
      allRequiredComplete: boolean;
      // The missing-checklist case itself, so callers can say so rather
      // than showing a silently empty list. The DB refuses to activate
      // these, and enrollments_missing_onboarding lists them.
      isMissingChecklist: boolean;
      outstandingRequired: EnrollmentOnboardingItem[];
    }
  | {
      mode: "legacy_untracked";
      // Named rather than implied: this Enrollment's onboarding happened
      // outside the CRM, so there is no progress to report and its absence
      // is not a blocker.
      requiredItems: readonly [];
      optionalItems: EnrollmentOnboardingItem[];
    };

export const assessOnboarding = ({
  tracking,
  items,
}: {
  tracking: OnboardingTracking | null | undefined;
  items: EnrollmentOnboardingItem[];
}): OnboardingAssessment => {
  const optionalItems = items.filter((item) => !item.is_required);

  if (tracking === "legacy_untracked") {
    return { mode: "legacy_untracked", requiredItems: [], optionalItems };
  }

  // Anything else — including a row that predates the column, or an
  // Enrollment that has not loaded one — is treated as tracked. Tracked is
  // the safe default: it can surface a missing checklist, whereas
  // defaulting to legacy would hide one.
  const requiredItems = items.filter((item) => item.is_required);
  const outstandingRequired = requiredItems.filter(
    (item) => item.status !== "done",
  );

  return {
    mode: "tracked",
    requiredItems,
    optionalItems,
    requiredDoneCount: requiredItems.length - outstandingRequired.length,
    allRequiredComplete:
      requiredItems.length > 0 && outstandingRequired.length === 0,
    isMissingChecklist: requiredItems.length === 0,
    outstandingRequired,
  };
};

// Whether onboarding leaves anything for Leif to do.
//
// The three cases differ, and collapsing them is what caused the original
// disagreement: a tracked checklist with work left is a blocker, a tracked
// Enrollment with NO checklist is a different kind of problem that must
// still be visible, and a legacy Enrollment is simply not this system's
// business.
export const onboardingBlocksSetup = (
  assessment: OnboardingAssessment,
): boolean => assessment.mode === "tracked" && !assessment.allRequiredComplete;
