import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  Database,
  Expand,
  FileUp,
  Loader2,
  Plus,
  SendHorizontal,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  unifiedCrmQuestionMaxLength,
  type UnifiedCrmAnswer,
  type UnifiedCrmConversationTurn,
  type UnifiedCrmPaymentDraft,
} from "@/lib/ai/unifiedCrmAssistant";
import type { UnifiedCrmReadContext } from "@/lib/ai/unifiedCrmReadContext";

import { PaymentDraftCard } from "./PaymentDraftCard";
import { SuggestionCards } from "./SuggestionCards";
import { Markdown } from "../misc/Markdown";
import type { CrmDataProvider } from "../providers/types";

const composerExpandTriggerLine = 3;
const composerScrollTriggerLine = 7;

const formatGeneratedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return value;
  }

  return date.toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

const getFallbackLineCount = (value: string) =>
  Math.max(1, value.split(/\r?\n/).length);

const syncTextareaHeight = (
  textarea: HTMLTextAreaElement | null,
  value: string,
  options?: {
    maxLines?: number;
  },
) => {
  if (!textarea) {
    return getFallbackLineCount(value);
  }

  if (value.length === 0) {
    textarea.style.height = "auto";
    textarea.style.overflowY = "hidden";
    return 1;
  }

  textarea.style.height = "auto";
  textarea.style.overflowY = "hidden";

  const fullHeight = textarea.scrollHeight;

  const styles = window.getComputedStyle(textarea);
  const lineHeight = Number.parseFloat(styles.lineHeight || "");
  const fontSize = Number.parseFloat(styles.fontSize || "16");
  const paddingTop = Number.parseFloat(styles.paddingTop || "0");
  const paddingBottom = Number.parseFloat(styles.paddingBottom || "0");
  const contentHeight = fullHeight - paddingTop - paddingBottom;
  const effectiveLineHeight =
    Number.isFinite(lineHeight) && lineHeight > 0
      ? lineHeight
      : Number.isFinite(fontSize) && fontSize > 0
        ? fontSize * 1.5
        : 24;

  if (contentHeight <= 0) {
    textarea.style.height = `${fullHeight}px`;
    return getFallbackLineCount(value);
  }

  const lineCount = Math.max(1, Math.ceil(contentHeight / effectiveLineHeight));
  const maxLines = options?.maxLines;

  if (maxLines && lineCount > maxLines) {
    const cappedHeight =
      effectiveLineHeight * maxLines + paddingTop + paddingBottom;
    textarea.style.height = `${cappedHeight}px`;
    textarea.style.overflowY = "auto";
    return lineCount;
  }

  textarea.style.height = `${fullHeight}px`;
  return lineCount;
};

type UnifiedCrmAnswerPanelProps = {
  context: UnifiedCrmReadContext | null;
  selectedModel: string;
  question: string;
  onQuestionChange: (question: string) => void;
  answer: UnifiedCrmAnswer | null;
  onAnswerChange: (answer: UnifiedCrmAnswer | null) => void;
  conversationHistory: UnifiedCrmConversationTurn[];
  paymentDraft: UnifiedCrmPaymentDraft | null;
  onPaymentDraftChange: (draft: UnifiedCrmPaymentDraft | null) => void;
  onNavigate?: () => void;
  onOpenView?: (view: "snapshot" | "import") => void;
};

export const UnifiedCrmAnswerPanel = ({
  context,
  selectedModel: _selectedModel,
  question,
  onQuestionChange,
  answer,
  onAnswerChange,
  conversationHistory,
  paymentDraft,
  onPaymentDraftChange,
  onNavigate,
  onOpenView,
}: UnifiedCrmAnswerPanelProps) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const expandedTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [composerLineCount, setComposerLineCount] = useState(1);
  const [isExpandedComposerOpen, setIsExpandedComposerOpen] = useState(false);

  const {
    error,
    isPending,
    mutate: askQuestion,
  } = useMutation({
    mutationKey: ["unified-crm-answer"],
    mutationFn: async (nextQuestion: string): Promise<UnifiedCrmAnswer> => {
      if (!context) {
        throw new Error(
          "Aspetta che la snapshot CRM sia pronta prima di fare una domanda.",
        );
      }

      return dataProvider.askUnifiedCrmQuestion(
        nextQuestion,
        context,
        conversationHistory,
      );
    },
    onSuccess: () => {
      onQuestionChange("");
      resetTextareaHeight();
    },
    onError: (mutationError: Error) => {
      notify(
        mutationError.message ||
          "Impossibile ottenere una risposta AI sul CRM unificato",
        {
          type: "error",
        },
      );
    },
  });

  const trimmedQuestion = question.trim();
  const latestAnswer = answer;
  const suggestedActions = latestAnswer?.suggestedActions ?? [];
  const hasConversation = !!latestAnswer || isPending || !!error;
  const canOpenExpandedComposer =
    composerLineCount >= composerExpandTriggerLine;

  const resetTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.overflowY = "hidden";
    }
    if (expandedTextareaRef.current) {
      expandedTextareaRef.current.style.height = "";
      expandedTextareaRef.current.style.overflowY = "";
    }
    setComposerLineCount(1);
  };

  const submitQuestion = (nextQuestion = question) => {
    const trimmed = nextQuestion.trim();
    if (!trimmed) {
      notify("Scrivi una domanda prima di inviare la richiesta.", {
        type: "warning",
      });
      return;
    }

    if (!context) {
      notify("Sto ancora caricando la snapshot CRM del launcher.", {
        type: "warning",
      });
      return;
    }

    onQuestionChange(trimmed);
    askQuestion(trimmed, {
      onSuccess: (nextAnswer) => {
        onAnswerChange(nextAnswer);
        onPaymentDraftChange(nextAnswer.paymentDraft ?? null);
      },
    });
    setIsExpandedComposerOpen(false);
    resetTextareaHeight();
  };

  useEffect(() => {
    setComposerLineCount(
      syncTextareaHeight(textareaRef.current, question, {
        maxLines: composerScrollTriggerLine - 1,
      }),
    );
  }, [question]);

  useEffect(() => {
    if (!isExpandedComposerOpen) {
      return;
    }

    requestAnimationFrame(() => {
      expandedTextareaRef.current?.focus();
      expandedTextareaRef.current?.setSelectionRange(
        question.length,
        question.length,
      );
    });
  }, [isExpandedComposerOpen, question]);

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div
          data-testid="unified-crm-scroll-area"
          className="flex-1 min-h-0 space-y-3 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 py-3 [touch-action:pan-y] [webkit-overflow-scrolling:touch]"
        >
          {!hasConversation ? (
            <SuggestionCards
              disabled={!context || isPending}
              onSelect={submitQuestion}
            />
          ) : null}

          {isPending ? (
            <div className="rounded-xl border border-dashed px-4 py-4 text-sm text-muted-foreground">
              Sto preparando una risposta grounded sul CRM...
            </div>
          ) : null}

          {latestAnswer ? (
            <div
              data-testid="unified-crm-answer"
              className="space-y-3 rounded-xl border px-4 py-4"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Risposta del {formatGeneratedAt(latestAnswer.generatedAt)}
                </span>
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="font-medium">Domanda:</span>{" "}
                {latestAnswer.question}
              </div>
              <Markdown className="overflow-hidden wrap-break-word text-sm leading-6 [&_h2]:mt-4 [&_h2]:text-sm [&_h2]:font-semibold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:font-semibold">
                {latestAnswer.answerMarkdown}
              </Markdown>

              {paymentDraft ? (
                <PaymentDraftCard
                  draft={paymentDraft}
                  routePrefix={context?.meta.routePrefix ?? "/#/"}
                  onChange={onPaymentDraftChange}
                  onNavigate={onNavigate}
                />
              ) : null}

              {suggestedActions.length > 0 ? (
                <div className="space-y-3 rounded-lg border border-dashed bg-muted/20 px-3 py-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Azioni suggerite</p>
                    <p className="text-xs text-muted-foreground">
                      Handoff verso route o superfici commerciali gia approvate
                      del CRM. Nessuna scrittura parte direttamente da qui.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    {suggestedActions.map((action) => (
                      <Button
                        key={action.id}
                        asChild
                        variant="outline"
                        className="h-auto w-full justify-between whitespace-normal px-3 py-2.5 text-left"
                      >
                        <a href={action.href} onClick={onNavigate}>
                          <span className="min-w-0 flex-1 space-y-1 overflow-hidden">
                            <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                              <span>{action.label}</span>
                              {action.recommended ? (
                                <Badge>Consigliata ora</Badge>
                              ) : null}
                              {action.kind === "approved_action" ? (
                                <Badge variant="secondary">
                                  Azione approvata
                                </Badge>
                              ) : null}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {action.description}
                            </span>
                            {action.recommendationReason ? (
                              <span className="block text-xs text-foreground/80">
                                {action.recommendationReason}
                              </span>
                            ) : null}
                          </span>
                          <ArrowRight className="size-4 shrink-0" />
                        </a>
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error.message}
            </div>
          ) : null}
        </div>

        <div
          data-testid="unified-crm-composer"
          className="shrink-0 bg-background px-3 pb-3 pt-1"
        >
          <Label htmlFor="unified-crm-question" className="sr-only">
            Fai una domanda sul CRM corrente
          </Label>
          <div className="flex items-end gap-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mb-0.5 size-9 shrink-0 rounded-full"
                  aria-label="Apri altre viste AI"
                >
                  <Plus className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top">
                <DropdownMenuItem onSelect={() => onOpenView?.("snapshot")}>
                  <Database className="size-4" />
                  Snapshot CRM
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onOpenView?.("import")}>
                  <FileUp className="size-4" />
                  Importa fatture e ricevute
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex min-w-0 flex-1 flex-col rounded-2xl border bg-muted/30 ring-ring/20 transition-shadow focus-within:ring-2">
              {canOpenExpandedComposer ? (
                <div className="flex justify-end px-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full text-muted-foreground"
                    aria-label="Apri editor esteso per la domanda"
                    onClick={() => setIsExpandedComposerOpen(true)}
                  >
                    <Expand className="size-4" />
                  </Button>
                </div>
              ) : null}

              <div className="flex items-end gap-2 px-1 pb-1">
                <Textarea
                  ref={textareaRef}
                  id="unified-crm-question"
                  value={question}
                  onChange={(event) => {
                    onQuestionChange(event.target.value);
                    setComposerLineCount(
                      syncTextareaHeight(event.target, event.target.value, {
                        maxLines: composerScrollTriggerLine - 1,
                      }),
                    );
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      (event.metaKey || event.ctrlKey)
                    ) {
                      event.preventDefault();
                      submitQuestion();
                    }
                  }}
                  placeholder="Chiedi qualcosa sul CRM..."
                  maxLength={unifiedCrmQuestionMaxLength}
                  rows={1}
                  className="min-h-0 flex-1 resize-none field-sizing-fixed border-0 bg-transparent py-2.5 pr-0 pl-3 text-sm leading-6 shadow-none focus-visible:ring-0"
                  disabled={!context || isPending}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={() => submitQuestion()}
                  disabled={!context || isPending || !trimmedQuestion}
                  className="m-1 size-8 shrink-0 rounded-full"
                  aria-label="Invia"
                >
                  {isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <SendHorizontal className="size-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={isExpandedComposerOpen}
        onOpenChange={setIsExpandedComposerOpen}
      >
        <DialogContent className="flex! h-dvh w-screen max-w-none! flex-col! gap-0! rounded-none border-0 p-0! sm:max-w-none!">
          <DialogTitle className="sr-only">
            Editor esteso della domanda
          </DialogTitle>
          <DialogDescription className="sr-only">
            Scrivi e invia la stessa domanda del launcher in una superficie
            estesa.
          </DialogDescription>

          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-14">
            <div className="min-h-0 flex-1 overflow-hidden rounded-3xl border bg-muted/20 px-4 py-4">
              <Textarea
                ref={expandedTextareaRef}
                value={question}
                onChange={(event) => {
                  onQuestionChange(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault();
                    submitQuestion();
                  }
                }}
                placeholder="Chiedi qualcosa sul CRM..."
                maxLength={unifiedCrmQuestionMaxLength}
                rows={1}
                className="h-full min-h-0 resize-none overflow-y-auto field-sizing-fixed border-0 bg-transparent px-0 py-0 text-base leading-7 shadow-none focus-visible:ring-0"
                disabled={!context || isPending}
              />
            </div>

            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                onClick={() => submitQuestion()}
                disabled={!context || isPending || !trimmedQuestion}
                className="gap-2"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <SendHorizontal className="size-4" />
                )}
                Invia
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
