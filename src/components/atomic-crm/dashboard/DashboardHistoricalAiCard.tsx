import { useMutation } from "@tanstack/react-query";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Download,
  Lightbulb,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";

import { AiBlockRenderer } from "./AiBlockRenderer";
import { Markdown } from "../misc/Markdown";
import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AiBlock } from "@/lib/analytics/annualAnalysis";
import {
  type HistoricalAnalyticsAnswer,
  type HistoricalAnalyticsSummary,
  type HistoricalVisualAnswer,
  type HistoricalVisualSummary,
  defaultHistoricalAnalysisModel,
  getHistoricalSuggestedQuestions,
  type HistoricalSuggestedQuestion,
} from "@/lib/analytics/historicalAnalysis";

// ── Type guards ──

const isVisualSummary = (
  d: HistoricalAnalyticsSummary | HistoricalVisualSummary,
): d is HistoricalVisualSummary => "blocks" in d;

const isVisualAnswer = (
  d: HistoricalAnalyticsAnswer | HistoricalVisualAnswer,
): d is HistoricalVisualAnswer => "blocks" in d;

// ── Visual mode persistence ──

const VISUAL_MODE_KEY = "historical-ai-visual-mode";
const getStoredVisualMode = () => {
  try {
    const stored = localStorage.getItem(VISUAL_MODE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
};
const storeVisualMode = (v: boolean) => {
  try {
    localStorage.setItem(VISUAL_MODE_KEY, String(v));
  } catch {
    /* noop */
  }
};

export const DashboardHistoricalAiCard = ({
  compact,
}: {
  compact?: boolean;
}) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const { aiConfig } = useConfigurationContext();
  const [question, setQuestion] = useState("");
  const [visualMode, setVisualMode] = useState(getStoredVisualMode);
  const [suggestionsOpen, setSuggestionsOpen] = useState(!compact);

  const toggleVisualMode = () => {
    setVisualMode((prev) => {
      const next = !prev;
      storeVisualMode(next);
      return next;
    });
  };

  // Use a single "scope" state to toggle between storico and incassi context
  const [scope, setScope] = useState<"storico" | "incassi">("storico");

  const {
    data: summary,
    isPending: isSummaryPending,
    mutate: generateSummary,
    reset: resetSummary,
  } = useMutation({
    mutationKey: ["historical-ai-summary", scope, visualMode],
    mutationFn: () => {
      if (scope === "incassi") {
        return dataProvider.generateHistoricalCashInflowSummary({
          visualMode,
        });
      }
      return dataProvider.generateHistoricalAnalyticsSummary({ visualMode });
    },
    onError: (mutationError: Error) => {
      notify(
        mutationError.message ||
          "Impossibile generare l'analisi AI dello storico",
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
    mutationKey: ["historical-ai-answer", scope, visualMode],
    mutationFn: (nextQuestion: string) => {
      if (scope === "incassi") {
        return dataProvider.askHistoricalCashInflowQuestion(nextQuestion, {
          visualMode,
        });
      }
      return dataProvider.askHistoricalAnalyticsQuestion(nextQuestion, {
        visualMode,
      });
    },
    onError: (mutationError: Error) => {
      notify(
        mutationError.message ||
          "Impossibile ottenere una risposta AI sullo storico",
        { type: "error" },
      );
    },
  });

  const _selectedModel =
    aiConfig?.historicalAnalysisModel ?? defaultHistoricalAnalysisModel;
  const suggestedQuestions = getHistoricalSuggestedQuestions();
  const isLoading = isSummaryPending || isAnswerPending;

  const handleScopeChange = (next: "storico" | "incassi") => {
    if (next === scope) return;
    setScope(next);
    resetSummary();
    resetAnswer();
    setQuestion("");
  };

  const submitQuestion = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuestion(trimmed);
    askQuestion(trimmed);
  };

  const resultRef = useRef<HTMLDivElement>(null);

  const printResult = useCallback(() => {
    const node = resultRef.current;
    if (!node) return;

    const portal = document.createElement("div");
    portal.setAttribute("data-print-portal", "");
    portal.innerHTML = node.innerHTML;
    document.body.appendChild(portal);

    const cleanup = () => {
      portal.remove();
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);

    window.print();
  }, []);

  const latestResult = resolveLatestResult({ answer, summary });

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 pb-0 flex flex-row items-center justify-between space-y-0 gap-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4" />
          Chiedi all'AI
        </CardTitle>
        <button
          type="button"
          onClick={toggleVisualMode}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            visualMode
              ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-300"
              : "border-gray-200 text-muted-foreground hover:bg-muted/50 dark:border-gray-700"
          }`}
          title={
            visualMode
              ? "Vista smart attiva — risposte con grafici e componenti visivi"
              : "Attiva vista smart per risposte con grafici"
          }
        >
          <Lightbulb className="h-3.5 w-3.5" />
          Vista smart
        </button>
      </CardHeader>

      <CardContent className="px-4 space-y-3">
        {/* ── Scope selector ── */}
        <div className="flex gap-1.5">
          <ScopeButton
            active={scope === "storico"}
            onClick={() => handleScopeChange("storico")}
            label="Lavoro svolto"
          />
          <ScopeButton
            active={scope === "incassi"}
            onClick={() => handleScopeChange("incassi")}
            label="Incassi ricevuti"
          />
        </div>

        {/* ── Primary action ── */}
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
          {scope === "incassi" ? "Spiegami gli incassi" : "Spiegami lo storico"}
        </Button>

        {/* ── Suggested questions — collapsible in compact mode ── */}
        <div className="space-y-1.5">
          {compact && (
            <button
              type="button"
              onClick={() => setSuggestionsOpen((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground font-medium hover:text-foreground transition-colors"
            >
              {suggestionsOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              Suggerimenti
            </button>
          )}
          {suggestionsOpen && (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {suggestedQuestions
                  .filter((s) => s.scope === scope && s.priority === 1)
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
                  .filter((s) => s.scope === scope && s.priority === 2)
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
            </>
          )}
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
          <div
            ref={resultRef}
            className="rounded-md border px-4 py-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">
                {latestResult.label}
              </p>
              <button
                type="button"
                onClick={printResult}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                title="Esporta come PDF"
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </button>
            </div>
            {latestResult.blocks ? (
              <AiBlockRenderer blocks={latestResult.blocks} />
            ) : (
              <Markdown className="text-sm leading-6 [&_h2]:mt-4 [&_h2]:text-sm [&_h2]:font-semibold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:font-semibold">
                {latestResult.markdown!}
              </Markdown>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ── Helpers ──

type LatestResult = {
  label: string;
  markdown?: string;
  blocks?: AiBlock[];
} | null;

function resolveLatestResult({
  answer,
  summary,
}: {
  answer: HistoricalAnalyticsAnswer | HistoricalVisualAnswer | undefined;
  summary: HistoricalAnalyticsSummary | HistoricalVisualSummary | undefined;
}): LatestResult {
  if (answer) {
    if (isVisualAnswer(answer)) {
      return { label: answer.question, blocks: answer.blocks };
    }
    return { label: answer.question, markdown: answer.answerMarkdown };
  }
  if (summary) {
    if (isVisualSummary(summary)) {
      return { label: "Riassunto storico", blocks: summary.blocks };
    }
    return { label: "Riassunto storico", markdown: summary.summaryMarkdown };
  }
  return null;
}

const ScopeButton = ({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-300"
        : "border-gray-200 text-muted-foreground hover:bg-muted/50 dark:border-gray-700"
    }`}
  >
    {label}
  </button>
);

const chipColors: Record<HistoricalSuggestedQuestion["color"], string> = {
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
  suggestion: HistoricalSuggestedQuestion;
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
