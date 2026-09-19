import type { EnrollmentOnboardingItem, OnboardingTracking } from "../types";
import { assessOnboarding } from "./assessOnboarding";

export type OnboardingProgress = {
  requiredItems: EnrollmentOnboardingItem[];
  optionalItems: EnrollmentOnboardingItem[];
  requiredDoneCount: number;
  // The single authoritative "is onboarding complete" answer — derived
  // ONLY from the checklist's own data, never from Enrollment.status
  // (status can lag or diverge from the checklist for reasons unrelated to
  // onboarding itself).
  allRequiredComplete: boolean;
  // A tracked Enrollment with no required items. Its checklist went
  // missing; it did not finish. Callers must say so rather than rendering
  // an empty list that reads as "nothing to do".
  isMissingChecklist: boolean;
  // Onboarding happened before the CRM tracked it. There is no progress to
  // show, and showing 0 of 0 would be a falsehood about a real person.
  isLegacyUntracked: boolean;
};

// Kept as the shape the UI already consumes, but the judgement now comes
// from assessOnboarding so this and assessPostSaleSetup cannot drift — the
// drift between them is precisely what made an empty checklist mean two
// different things in the same app.
export const computeOnboardingProgress = (
  items: EnrollmentOnboardingItem[],
  tracking?: OnboardingTracking | null,
): OnboardingProgress => {
  const assessment = assessOnboarding({ tracking, items });

  if (assessment.mode === "legacy_untracked") {
    return {
      requiredItems: [],
      optionalItems: assessment.optionalItems,
      requiredDoneCount: 0,
      // Not "complete". Legacy onboarding makes no claim either way, and
      // callers branch on isLegacyUntracked rather than reading this.
      allRequiredComplete: false,
      isMissingChecklist: false,
      isLegacyUntracked: true,
    };
  }

  return {
    requiredItems: assessment.requiredItems,
    optionalItems: assessment.optionalItems,
    requiredDoneCount: assessment.requiredDoneCount,
    allRequiredComplete: assessment.allRequiredComplete,
    isMissingChecklist: assessment.isMissingChecklist,
    isLegacyUntracked: false,
  };
};
