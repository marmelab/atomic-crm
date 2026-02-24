import type { DealStage } from "../types";

type TranslateFn = (key: string, options?: { [key: string]: any }) => string;

const defaultDealStageLabels: Record<string, string> = {
  opportunity: "Opportunity",
  "proposal-sent": "Proposal Sent",
  "in-negociation": "In Negotiation",
  won: "Won",
  lost: "Lost",
  delayed: "Delayed",
};

const getDealStageTranslationKey = (stageValue: string) =>
  `crm.deals.stages.${stageValue.replaceAll("-", "_")}`;

export const getTranslatedDealStageLabel = (
  stage: Pick<DealStage, "value" | "label">,
  translate: TranslateFn,
) => {
  const defaultLabel = defaultDealStageLabels[stage.value];
  if (!defaultLabel || stage.label !== defaultLabel) {
    return stage.label;
  }

  return translate(getDealStageTranslationKey(stage.value), {
    _: stage.label,
  });
};
