import { useMutation } from "@tanstack/react-query";
import { Bot, RefreshCw, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";

import { Markdown } from "../misc/Markdown";
import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultAnnualAnalysisModel,
  getAnnualOperationsSuggestedQuestions,
  type SuggestedQuestion,
} from "@/lib/analytics/annualAnalysis";

export const DashboardAnnualAiSummaryCard = ({ year }: { year: number }) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const { aiConfig } = useConfigurationContext();
  const [question, setQuestion] = useState("");

  const {
    data: summary,
    isPending: isSummaryPending,
    mutate: generateSummary,
    reset: resetSummary,
  } = useMutation({
    mutationKey: ["annual-ai-summary", year],
    mutationFn: () =>
      dataProvider.generateAnnualOperationsAnalyticsSummary(year),
    onError: (mutationError: Error) => {
      notify(
        mutationError.message || "Impossibile generare l'analisi AI di Annuale",
        { type: "error" },
      );
    },
  });

  const {
    data: answer,
    isPending: isAnswerPending,
    mutate: askQuestion,
    reset: resetAnswer,
  } = useMutation({
    mutationKey: ["annual-ai-answer", year],
    mutationFn: (nextQuestion: string) =>
      dataProvider.askAnnualOperationsQuestion(year, nextQuestion),
    onError: (mutationError: Error) => {
      notify(
        mutationError.message ||
          "Impossibile ottenere una risposta AI sulla vista Annuale",
        { type: "error" },
      );
    },
  });

  const _selectedModel =
    aiConfig?.historicalAnalysisModel ?? defaultAnnualAnalysisModel;
  const isCurrentYear = year === new Date().getFullYear();
  const suggestedQuestions = getAnnualOperationsSuggestedQuestions({
    year,
    isCurrentYear,
  });
  const isLoading = isSummaryPending || isAnswerPending;

  useEffect(() => {
    setQuestion("");
    resetSummary();
    resetAnswer();
  }, [year, resetAnswer, resetSummary]);

  const submitQuestion = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    askQuestion(trimmed);
  };

  // Latest result to show (answer takes priority over summary)
  const latestResult = answer
    ? { label: answer.question, content: answer.answerMarkdown }
    : summary
      ? { label: `Riassunto ${year}`, content: summary.summaryMarkdown }
      : null;

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 pb-0 flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4" />
          Chiedi all'AI
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 space-y-3">
        {/* ── Primary action — one click to understand the year ── */}
        <Button
          type="button"
          disabled={isLoading}
          onClick={() => generateSummary()}
          className="w-full gap-2 bg-sky-600 hover:bg-sky-700 text-white dark:bg-sky-500 dark:hover:bg-sky-600 dark:text-white"
          size="lg"
        >
          {isSummaryPending ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Spiegami l'anno {year}
        </Button>

        {/* ── Suggested questions — priority 1 bigger, priority 2 smaller ── */}
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            {suggestedQuestions
              .filter((s) => s.priority === 1)
              .map((s) => (
                <QuestionChip
                  key={s.label}
                  suggestion={s}
                  disabled={isLoading}
                  onClick={() => submitQuestion(s.question)}
                />
              ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestedQuestions
              .filter((s) => s.priority === 2)
              .map((s) => (
                <QuestionChip
                  key={s.label}
                  suggestion={s}
                  disabled={isLoading}
                  onClick={() => submitQuestion(s.question)}
                  small
                />
              ))}
          </div>
        </div>

        {/* ── Free question input ── */}
        <div className="flex gap-2">
          <Textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Oppure scrivi la tua domanda..."
            maxLength={300}
            className="min-h-10 resize-none"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitQuestion(question);
              }
            }}
          />
          <Button
            onClick={() => submitQuestion(question)}
            disabled={isLoading || !question.trim()}
            size="icon"
            className="shrink-0"
          >
            {isAnswerPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* ── Result ── */}
        {latestResult && (
          <div className="rounded-md border px-4 py-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">
              {latestResult.label}
            </p>
            <Markdown className="text-sm leading-6 [&_h2]:mt-4 [&_h2]:text-sm [&_h2]:font-semibold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:font-semibold">
              {latestResult.content}
            </Markdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const chipColors: Record<SuggestedQuestion["color"], string> = {
  emerald:
    "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950",
  sky: "border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-300 dark:hover:bg-sky-950",
  amber:
    "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950",
  red: "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-950",
};

const QuestionChip = ({
  suggestion,
  disabled,
  onClick,
  small,
}: {
  suggestion: SuggestedQuestion;
  disabled: boolean;
  onClick: () => void;
  small?: boolean;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`rounded-md border px-3 font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${chipColors[suggestion.color]} ${small ? "py-1 text-xs" : "py-1.5 text-sm"}`}
  >
    {suggestion.label}
  </button>
);
