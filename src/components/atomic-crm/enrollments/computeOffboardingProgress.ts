import type { EnrollmentOffboardingItem } from "../types";

export type OffboardingProgress = {
  requiredItems: EnrollmentOffboardingItem[];
  optionalItems: EnrollmentOffboardingItem[];
  requiredDoneCount: number;
  // The single authoritative "is offboarding complete" answer — derived
  // ONLY from the checklist's own data, mirroring
  // computeOnboardingProgress.ts's own OnboardingProgress.allRequiredComplete
  // exactly (same reasoning: never inferred from Enrollment.status).
  // Requires at least one required item to exist, so an Offer with zero
  // configured offboarding requirements never trivially reads as
  // "complete" — Client Offboarding slice, §5's explicit "handle that
  // state explicitly and safely" instruction.
  allRequiredComplete: boolean;
};

// The ONE shared calculation both the Complete-client gate and
// ClientShow's own offboarding-section rendering derive from — mirrors
// computeOnboardingProgress.ts exactly, so neither can drift from the
// other's definition of "done".
export const computeOffboardingProgress = (
  items: EnrollmentOffboardingItem[],
): OffboardingProgress => {
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
