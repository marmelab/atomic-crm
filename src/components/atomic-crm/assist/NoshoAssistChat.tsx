import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAssist } from "./assistStore";
import { useAssistChat } from "./useAssistChat";

const TYPE_LABEL: Record<"bug" | "feature" | "question", string> = {
  bug: "Bug",
  feature: "Idée de fonctionnalité",
  question: "Question",
};

export function NoshoAssistChat() {
  const { isOpen, initialMessage, close } = useAssist();
  const {
    messages,
    draft,
    isSending,
    isSubmitting,
    error,
    sendMessage,
    submitDraft,
    reset,
  } = useAssistChat();

  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState<{ url?: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset state on open, optionally seeding the textarea with a message.
  useEffect(() => {
    if (!isOpen) return;
    reset();
    setSubmitted(null);
    setInput(initialMessage ?? "");
    // Focus shortly after the sheet animation starts.
    const t = setTimeout(() => textareaRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, [isOpen, initialMessage, reset]);

  // Auto-scroll on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSubmit = async () => {
    const result = await submitDraft();
    if (result?.ok) {
      setSubmitted({ url: result.issueUrl });
    }
  };

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-md flex flex-col p-0 gap-0"
      >
        <SheetHeader className="border-b">
          <div className="flex items-center gap-3 pr-8">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--nosho-orange)] to-[var(--nosho-green)] shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="flex flex-col min-w-0">
              <SheetTitle>Nosho AI Assist</SheetTitle>
              <SheetDescription>
                Décrivez un bug, une idée, ou posez une question.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        >
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              Comment puis-je vous aider ?
              <br />
              <span className="text-xs">
                Tapez votre message ci-dessous, je vous poserai quelques
                questions et je transmettrai votre demande à l'équipe.
              </span>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} role={msg.role} content={msg.content} />
          ))}

          {isSending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Nosho réfléchit…</span>
            </div>
          )}

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {draft && !submitted && (
            <div className="rounded-lg border border-[var(--nosho-green)]/40 bg-[var(--nosho-green)]/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--nosho-green-dark)]">
                  {TYPE_LABEL[draft.type]}
                </span>
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                {draft.title}
              </h4>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                {draft.summary}
              </p>
              <Button
                type="button"
                size="sm"
                className="w-full bg-[var(--nosho-green)] hover:bg-[var(--nosho-green-dark)] text-white"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Envoi…
                  </>
                ) : (
                  <>Envoyer la demande à l'équipe</>
                )}
              </Button>
            </div>
          )}

          {submitted && (
            <div className="rounded-lg border border-[var(--nosho-green)]/40 bg-[var(--nosho-green)]/10 p-4 text-sm text-foreground">
              <p className="font-semibold mb-1">Merci !</p>
              <p className="text-xs text-muted-foreground">
                Votre demande a bien été envoyée à l'équipe Nosho. Vous serez
                tenu au courant sur Slack.
              </p>
              {submitted.url && (
                <a
                  href={submitted.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[var(--nosho-green-dark)] underline mt-2 inline-block"
                >
                  Voir le ticket
                </a>
              )}
            </div>
          )}
        </div>

        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Comment puis-je vous aider ?"
              rows={2}
              className="resize-none min-h-[44px] max-h-32"
              disabled={isSending || !!submitted}
            />
            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isSending || !!submitted}
              className="shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
            Entrée pour envoyer · Maj+Entrée pour aller à la ligne
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  // Strip the JSON fence from the assistant display - the parsed draft is
  // already shown as a structured card below the message stream.
  const display =
    role === "assistant"
      ? content.replace(/```json[\s\S]*?```/gi, "").trim()
      : content;

  if (role === "assistant" && !display) return null;

  return (
    <div
      className={cn("flex", role === "user" ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap",
          role === "user"
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm",
        )}
      >
        {display}
      </div>
    </div>
  );
}
