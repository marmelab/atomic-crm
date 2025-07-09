import { EngagementStage } from '../types';

export const findEngagementLabel = (engagementStages: EngagementStage[], engagementValue: string) => {
    const stage = engagementStages.find(s => s.value === engagementValue);
    return stage ? stage.label : engagementValue;
};
