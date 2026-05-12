/**
 * Type declarations for values provided by test/globalSetup.ts via
 * Vitest's provide/inject mechanism.
 */
declare module "vitest" {
  export interface ProvidedContext {
    aimockUrl: string;
    aimockFixtures: Array<{
      match: Record<string, unknown>;
      response: Record<string, unknown>;
    }>;
  }
}
