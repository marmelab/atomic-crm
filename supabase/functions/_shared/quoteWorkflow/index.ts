/**
 * Quote workflow shared module — barrel export for the extracted helpers.
 *
 * Prefer importing from this file rather than individual sub-files so that
 * future reshuffles of the internal structure don't cascade into edge
 * function imports. Phase 1 scope lives here:
 *
 *  - constants: status/role/step identifiers
 *  - schemas: types for AI-generated sections
 *  - generateSections: Anthropic API call + regex parser (single source)
 *  - normalizeSections: default content merge for orchestrated proposals
 *  - pipelineLogger: withPipelineStep() helper for step-level observability
 */

export * from "./constants.ts";
export * from "./schemas.ts";
export * from "./generateSections.ts";
export * from "./normalizeSections.ts";
export * from "./pipelineLogger.ts";
export * from "./createSigningSubmission.ts";
export * from "./saveQuoteContent.ts";
export * from "./validationReporter.ts";
export * from "./takeSnapshot.ts";
export * from "./signingEmail.ts";
export * from "./sendSigningEmail.ts";
