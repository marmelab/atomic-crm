import type { DealStage } from "../types";
import { getTranslatedDealStageLabel } from "./getTranslatedDealStageLabel";

type TranslateFn = (key: string, options?: { [key: string]: any }) => string;

export const findDealLabel = (
  dealStages: DealStage[],
  dealValue: string,
  translate?: TranslateFn,
) => {
  const dealStage = dealStages.find((stage) => stage.value === dealValue);
  if (!dealStage) {
    return undefined;
  }

  if (!translate) {
    return dealStage.label;
  }

  return getTranslatedDealStageLabel(dealStage, translate);
};
