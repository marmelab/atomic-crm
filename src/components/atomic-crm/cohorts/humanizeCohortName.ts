// Strips a Cohort's parent group Offer's own initials from its display
// name when they're redundantly embedded (UX cleanup pass, §3) — e.g.
// "September GYU Cohort" shown under the "Growing Yourself Up" Offer
// heading becomes "September Cohort": the owner already knows which Offer
// they're looking at from the surrounding heading, so repeating its
// initials in every Cohort name underneath is noise, not information.
//
// Pure presentation helper — never mutates the persisted Cohort name (the
// stored "September GYU Cohort" stays exactly what it is; this is only
// applied where a Cohort is rendered directly under its Offer's own
// heading). A general, non-hardcoded algorithm (derives the Offer's
// initials from its actual name, not a literal "GYU" special case), so it
// generalizes to any future group Offer with the same naming habit — and
// falls back to the Cohort's real name unchanged if no redundant token is
// found, so it never mangles an unrelated naming convention.
export const humanizeCohortName = (
  cohortName: string,
  offerName: string,
): string => {
  const initials = offerName
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  // Too short to be a meaningful, unambiguous token to strip (e.g. a
  // one-word Offer name would produce a single-letter "initials" that
  // could coincidentally match unrelated text in the Cohort name).
  if (initials.length < 2) return cohortName;

  const stripped = cohortName
    .replace(new RegExp(`\\b${initials}\\b\\s*`, "i"), "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || cohortName;
};
