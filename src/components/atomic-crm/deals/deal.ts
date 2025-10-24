import type { DealStage } from "@/components/atomic-crm/types";

export const findDealLabel = (dealStages: DealStage[], dealValue: string) => {
  return dealStages.find((dealStage) => dealStage.value === dealValue)?.label;
};
