import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getSupabaseClient } from "../providers/supabase/supabase";

export type GenerateArgs = {
  dealId: number;
  contactId?: number | null;
  force?: boolean;
};

export type ProposalUrls = { editUrl: string; publicUrl: string };

export type ProposalErrorPayload = {
  error: string;
  issues?: { message?: string; path?: string[] }[];
};

export class GenerateProposalError extends Error {
  public code: string;
  public issues: { message?: string; path?: string[] }[];
  constructor(payload: ProposalErrorPayload) {
    super(payload.error);
    this.code = payload.error;
    this.issues = payload.issues ?? [];
  }
}

/**
 * Invokes the `generate-proposal` edge function.
 *
 * Returns the new URLs on a fresh generation (200) OR the pre-existing
 * URLs when the deal already has a proposal and `force` is not set (409).
 * Callers can distinguish the two cases by the `alreadyExisted` flag.
 */
export function useGenerateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      args: GenerateArgs,
    ): Promise<ProposalUrls & { alreadyExisted: boolean }> => {
      const { data, error } = await getSupabaseClient().functions.invoke<
        ProposalUrls | ProposalErrorPayload
      >("generate-proposal", {
        method: "POST",
        body: args,
      });

      if (error) {
        // Supabase wraps non-2xx as errors; body is in error.context
        const status = (error as { context?: Response }).context?.status;
        let body: ProposalErrorPayload = { error: "unknown_error" };
        try {
          body =
            (await (error as { context?: Response }).context?.json()) ?? body;
        } catch {
          // keep default
        }
        if (
          status === 409 &&
          "editUrl" in (body as unknown as ProposalUrls) &&
          "publicUrl" in (body as unknown as ProposalUrls)
        ) {
          const urls = body as unknown as ProposalUrls;
          return { ...urls, alreadyExisted: true };
        }
        throw new GenerateProposalError(body);
      }

      if (!data || !("editUrl" in data) || !("publicUrl" in data)) {
        throw new GenerateProposalError({ error: "invalid_response" });
      }
      return { ...(data as ProposalUrls), alreadyExisted: false };
    },
    onSuccess: () => {
      // Refresh the deal record so the UI picks up the new URLs.
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["deals_summary"] });
    },
  });
}
