import { ConfigurationContextValue } from '../root/ConfigurationContext';
import { Engagement } from '../types';

export type EngagementsByStage = { [stage: string]: Engagement[] };
export function getEngagementsByStage(engagements: Engagement[], stages: any[]): EngagementsByStage {
    const byStage: EngagementsByStage = {};
    for (const stage of stages) {
        byStage[stage.value] = [];
    }
    for (const engagement of engagements) {
        if (byStage[engagement.stage]) {
            byStage[engagement.stage].push(engagement);
        }
    }
    return byStage;
}
