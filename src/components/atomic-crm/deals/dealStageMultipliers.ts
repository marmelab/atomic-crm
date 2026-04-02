import type { DealStage } from "../types";

/**
 * Default multipliers when a stage has no `multiplier` in app config (legacy data)
 * or for slugs not yet saved from Settings. Prefer editing weights in
 * **Settings → Deals → Stages** (per-stage "Forecast weight" field).
 */
export const DEAL_STAGE_MULTIPLIERS: Record<string, number> = {
  opportunity: 0.2,
  "proposal-sent": 0.5,
  "in-negociation": 0.8,
  delayed: 0.3,
  won: 1,
  lost: 0,
  // Common alternate slugs (from labels) if DB has these without saved multiplier
  prospecting: 0.15,
  discovery: 0.2,
  demo: 0.35,
};

export function getDealStageMultiplier(stage: string): number {
  return DEAL_STAGE_MULTIPLIERS[stage] ?? 0;
}

function clampMultiplier(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/** Resolved 0–1 weight: config `multiplier` wins, else fallback map. */
export function resolveDealStageMultiplier(
  stage: string,
  dealStages: Pick<DealStage, "value" | "multiplier">[],
): number {
  const row = dealStages.find((s) => s.value === stage);
  if (
    row &&
    typeof row.multiplier === "number" &&
    Number.isFinite(row.multiplier)
  ) {
    return clampMultiplier(row.multiplier);
  }
  return getDealStageMultiplier(stage);
}

/** Ensure every stage has a numeric multiplier for display (merged config). */
export function withResolvedDealStageMultipliers(
  stages: DealStage[] | undefined,
): DealStage[] {
  if (!stages?.length) return [];
  return stages.map((s) => ({
    ...s,
    multiplier: resolveDealStageMultiplier(s.value, stages),
  }));
}
