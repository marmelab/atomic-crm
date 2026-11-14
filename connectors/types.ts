/**
 * The single interface of every integration (docs/PRODUCT_RULES.md): all
 * external calls, AI included, go through a connector in /connectors.
 *
 * A connector is plain TypeScript with no runtime-specific imports, so the
 * same file runs in a Supabase Edge Function (Deno) and in Vitest (Node).
 * It never reads secrets itself: the caller passes them in the context.
 */

export interface ConnectorContext {
  /** Injected so that tests replace the network with canned answers */
  fetch: typeof fetch;
  /** Abort the external call after this many milliseconds */
  timeoutMs?: number;
  /** Secrets and settings of the connector, read by the server from its environment */
  settings?: Record<string, string | undefined>;
}

export interface Connector<Input, Output> {
  /** Stable id, also the folder name: "vies" */
  id: string;
  /** What the connector is for: registry, payments, messaging, ai... */
  kind: "registry" | "payments" | "fiscal" | "messaging" | "ai" | "bank";
  call: (input: Input, context: ConnectorContext) => Promise<Output>;
}

export const DEFAULT_TIMEOUT_MS = 15_000;

/** fetch with the timeout of the context. */
export const fetchWithTimeout = (
  context: ConnectorContext,
  url: string,
  init: RequestInit = {},
): Promise<Response> =>
  context.fetch(url, {
    ...init,
    signal: AbortSignal.timeout(context.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
