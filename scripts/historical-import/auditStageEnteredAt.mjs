// Phase 4P audit: classify EVERY planned historical Deal's stage_entered_at
// by the strength of the evidence actually behind it. Pure analysis — no
// writes, no DB access, no manifest mutation. Reads the same gitignored
// source + rulings the generator does.
//
// Evidence classes (see the Phase 4P prompt's own definitions):
//   A EXACT_STAGE_EVIDENCE        a real source event directly supports
//                                 entry into THIS canonical stage
//   B CREATION_IS_STAGE_ENTRY     the Deal began and demonstrably remained
//                                 in its current stage, so creation time
//                                 IS legitimate stage-entry evidence
//   C APPROXIMATE_SOURCE_TIMESTAMP a real source timestamp exists but is
//                                 not exact evidence for this transition
//   D UNKNOWN                     no defensible source timestamp at all

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planPerson } from "./plan.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");
const readJSON = (p) =>
  JSON.parse(fs.readFileSync(path.join(DATA_DIR, p), "utf8"));

const staging = readJSON("phase3_staging_reproduced.json");
const rulings = readJSON("rulings.json");

/**
 * Does the stage-transition event that supplied this timestamp actually
 * evidence entry into THIS stage, or is it a different real event being
 * used as a proxy? The planner already marks proxied events
 * `approximate: true` (see plan.mjs) — that flag is the authoritative
 * signal here, not a re-derivation.
 */
const CLASS_CODE = {
  EXACT_STAGE_EVIDENCE: "A",
  CREATION_IS_STAGE_ENTRY: "B",
  APPROXIMATE_SOURCE_TIMESTAMP: "C",
};

function classify(deal) {
  // Read the planner own committed evidence class (plan.mjs
  // resolveDealTimestamps) rather than re-deriving it here — one source of
  // truth, so this audit can never drift from what actually gets written.
  const cls = CLASS_CODE[deal.stageEnteredAtEvidence];
  if (!cls)
    return {
      cls: "D",
      why: `no-evidence-class:${deal.stageEnteredAtEvidence}`,
    };
  return { cls, why: deal.stageEnteredAtEvidence };
}

const counts = { A: 0, B: 0, C: 0, D: 0 };
const byClassAndStage = {};
const unknownByStage = {};
const approximateByStage = {};
const detail = [];

for (const person of staging.records) {
  const planned = planPerson(person, rulings);
  const deals =
    planned.dualDealPlans ?? (planned.dealPlan ? [planned.dealPlan] : []);
  for (const deal of deals) {
    const { cls, why } = classify(deal);
    counts[cls]++;
    const key = `${cls}:${deal.stage}`;
    byClassAndStage[key] = (byClassAndStage[key] ?? 0) + 1;
    if (cls === "D")
      unknownByStage[deal.stage] = (unknownByStage[deal.stage] ?? 0) + 1;
    if (cls === "C")
      approximateByStage[deal.stage] =
        (approximateByStage[deal.stage] ?? 0) + 1;
    detail.push({
      sourceKeyHint: `phase3-2026:${person.canonicalEmail}:deal`,
      stage: deal.stage,
      outcome: deal.outcome,
      cls,
      why,
      stageEnteredAt: deal.stageEnteredAt,
      createdAt: deal.createdAt,
    });
  }
}

// Rulings-driven Fall enrollment additions are written by the
// generator, not planPerson — classified explicitly from their own ruling
// evidence rather than silently omitted from this audit.
const additions =
  rulings.gyuJanuaryReconciliation.fallEnrollmentAdditions ?? {};
for (const [email, ruling] of Object.entries(additions)) {
  const person = staging.records.find((r) => r.canonicalEmail === email);
  const hasDate =
    person?.acuityEarliestCallDate ?? person?.notionCallDate ?? null;
  const cls = hasDate ? "C" : "D";
  counts[cls]++;
  const stage = ruling.dealStage ?? "won";
  if (cls === "D") unknownByStage[stage] = (unknownByStage[stage] ?? 0) + 1;
  if (cls === "C")
    approximateByStage[stage] = (approximateByStage[stage] ?? 0) + 1;
  detail.push({
    sourceKeyHint: `ruling-addition:${email}:deal`,
    stage,
    cls,
    why: hasDate
      ? "ruling-deal-with-only-approximate-source-date"
      : "ruling-deal-with-no-source-date",
    stageEnteredAt: hasDate,
    createdAt: hasDate,
  });
}

const total = counts.A + counts.B + counts.C + counts.D;
// eslint-disable-next-line no-console
console.log(
  JSON.stringify(
    {
      totalDeals: total,
      evidenceClasses: {
        EXACT_STAGE_EVIDENCE: counts.A,
        CREATION_IS_STAGE_ENTRY: counts.B,
        APPROXIMATE_SOURCE_TIMESTAMP: counts.C,
        UNKNOWN: counts.D,
      },
      unknownByStage,
      approximateByStage,
      byClassAndStage,
    },
    null,
    2,
  ),
);

fs.writeFileSync(
  path.join(DATA_DIR, "stage_entered_at_audit.json"),
  JSON.stringify(
    { counts, unknownByStage, approximateByStage, detail },
    null,
    2,
  ),
);
