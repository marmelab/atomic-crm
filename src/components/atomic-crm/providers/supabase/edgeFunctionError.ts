/**
 * Extracts a user-facing error message from a Supabase Edge Function error.
 *
 * The error object from `supabase.functions.invoke` may carry a `.context`
 * response whose JSON body contains a `message` field.  If that extraction
 * fails for any reason we fall back to the provided `fallback` string.
 */
export const extractEdgeFunctionErrorMessage = async (
  error: unknown,
  fallback: string,
): Promise<string> => {
  try {
    const ctx = error as { context?: { json: () => Promise<unknown> } } | null;
    const details = (await ctx?.context?.json()) as
      | { message?: string }
      | null
      | undefined;
    return details?.message || fallback;
  } catch {
    return fallback;
  }
};
