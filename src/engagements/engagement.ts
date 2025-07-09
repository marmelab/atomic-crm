import { EngagementStage } from '../types';

export function findEngagementLabel(stages: { value: string; label: string }[], value: string) {
    const stage = stages.find(stage => stage.value === value);
    return stage ? stage.label : value;
}
