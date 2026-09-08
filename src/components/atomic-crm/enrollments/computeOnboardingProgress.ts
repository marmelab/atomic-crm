import type { EnrollmentOnboardingItem } from "../types";

export type OnboardingProgress = {
  requiredItems: EnrollmentOnboardingItem[];
  optionalItems: EnrollmentOnboardingItem[];
  requiredDoneCount: number;
  // The single authoritative "is onboarding complete" answer — derived
  // ONLY from the checklist's own data, never from Enrollment.status
  // (ClientShow onboarding-hierarchy repair's own explicit state rule:
  // status can lag or diverge from the checklist for reasons unrelated
  // to onboarding itself). Requires at least one required item to
  // exist — same guard the pre-existing Activate-button gate
  // (ClientShow.tsx's own readyToActivate) already used, so an Offer
  // with zero required items never trivially reads as "complete".
  allRequiredComplete: boolean;
};

// The ONE shared calculation both the Activate-button gate and the
// ClientShow onboarding-hierarchy repair (collapsed-after-Sessions vs.
// expanded-near-top) derive from — extracted so neither ever drifts
// from the other's definition of "done".
export const computeOnboardingProgress = (
  items: EnrollmentOnboardingItem[],
): OnboardingProgress => {
  const requiredItems = items.filter((item) => item.is_required);
  const optionalItems = items.filter((item) => !item.is_required);
  const requiredDoneCount = requiredItems.filter(
    (item) => item.status === "done",
  ).length;

  return {
    requiredItems,
    optionalItems,
    requiredDoneCount,
    allRequiredComplete:
      requiredItems.length > 0 && requiredDoneCount === requiredItems.length,
  };
};
