import { useCallback, useRef, useState } from "react";
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
  draft: AssistDraft | null;
};

type SubmitResponse = {
  ok: boolean;
  issueUrl?: string;
  issueNumber?: number;
};

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `nosho-${crypto.randomUUID()}`;
  }
  return `nosho-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useAssistChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<AssistDraft | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string>(generateSessionId());

  const reset = useCallback(() => {
    setMessages([]);
    setDraft(null);
    setError(null);
    setIsSending(false);
    setIsSubmitting(false);
    // Fresh sessionId — n8n memory is keyed on this, so a new one starts a
    // clean conversation.
    sessionIdRef.current = generateSessionId();
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      setError(null);
      const userMessage: ChatMessage = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMessage]);
      setIsSending(true);

      try {
        const { data, error: invokeError } =
          await getSupabaseClient().functions.invoke<AssistChatResponse>(
            "assist-chat",
            {
              body: {
                sessionId: sessionIdRef.current,
                message: trimmed,
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
        if (!data) throw new Error("Réponse vide de l'assistant");

        const reply = data.reply ?? "";
        if (reply) {
          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: reply,
          };
          setMessages((prev) => [...prev, assistantMessage]);
        }

        if (data.draft) {
          setDraft(data.draft);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setIsSending(false);
      }
    },
    [isSending],
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
              sessionId: sessionIdRef.current,
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
