import type { DealStage } from "../types";

type TranslateFn = (key: string, options?: { [key: string]: any }) => string;

export const findDealLabel = (
  dealStages: DealStage[],
  dealValue: string,
  _translate?: TranslateFn,
) => {
  const dealStage = dealStages.find((stage) => stage.value === dealValue);
  if (!dealStage) {
    return undefined;
  }

  return dealStage.label;
};
