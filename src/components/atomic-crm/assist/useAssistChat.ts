import { useCallback, useState } from "react";
import { getSupabaseClient } from "../providers/supabase/supabase";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistDraft = {
  type: "bug" | "feature" | "question";
  title: string;
  summary: string;
  ready: true;
};

type AssistChatResponse = {
  reply: string;
  draft?: AssistDraft;
};

type SubmitResponse = {
  ok: boolean;
  issueUrl?: string;
};

/**
 * Try to extract a JSON draft from the assistant's reply.
 * Claude is instructed to wrap its final answer in a ```json ... ``` block.
 */
function extractDraft(text: string): AssistDraft | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : null;
  if (!candidate) return null;
  try {
    const parsed = JSON.parse(candidate);
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.ready === true &&
      typeof parsed.title === "string" &&
      typeof parsed.summary === "string" &&
      ["bug", "feature", "question"].includes(parsed.type)
    ) {
      return parsed as AssistDraft;
    }
  } catch {
    return null;
  }
  return null;
}

export function useAssistChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<AssistDraft | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setMessages([]);
    setDraft(null);
    setError(null);
    setIsSending(false);
    setIsSubmitting(false);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      setError(null);
      const userMessage: ChatMessage = { role: "user", content: trimmed };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setIsSending(true);

      try {
        const { data, error: invokeError } =
          await getSupabaseClient().functions.invoke<AssistChatResponse>(
            "assist-chat",
            {
              body: {
                messages: nextMessages,
                context: {
                  currentRoute:
                    typeof window !== "undefined"
                      ? window.location.pathname + window.location.hash
                      : "",
                },
              },
            },
          );

        if (invokeError) throw invokeError;
        if (!data?.reply) throw new Error("Réponse vide de l'assistant");

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.reply,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        const extracted = data.draft ?? extractDraft(data.reply);
        if (extracted) setDraft(extracted);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsSending(false);
      }
    },
    [messages, isSending],
  );

  const submitDraft = useCallback(async (): Promise<SubmitResponse | null> => {
    if (!draft || isSubmitting) return null;
    setError(null);
    setIsSubmitting(true);
    try {
      const { data, error: invokeError } =
        await getSupabaseClient().functions.invoke<SubmitResponse>(
          "assist-submit",
          {
            body: {
              draft,
              currentRoute:
                typeof window !== "undefined"
                  ? window.location.pathname + window.location.hash
                  : "",
              userAgent:
                typeof navigator !== "undefined" ? navigator.userAgent : "",
              transcript: messages,
            },
          },
        );
      if (invokeError) throw invokeError;
      return data ?? null;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [draft, messages, isSubmitting]);

  return {
    messages,
    draft,
    isSending,
    isSubmitting,
    error,
    sendMessage,
    submitDraft,
    reset,
  };
}
