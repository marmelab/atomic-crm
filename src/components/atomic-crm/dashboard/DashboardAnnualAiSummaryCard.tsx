import { useMutation } from "@tanstack/react-query";
import { Bot, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";

import { Markdown } from "../misc/Markdown";
import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultAnnualAnalysisModel,
  getAnnualOperationsSuggestedQuestions,
} from "@/lib/analytics/annualAnalysis";

const formatGeneratedAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

export const DashboardAnnualAiSummaryCard = ({ year }: { year: number }) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const { aiConfig } = useConfigurationContext();
  const [question, setQuestion] = useState("");

  const {
    data: summary,
    error: summaryError,
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
        {
          type: "error",
        },
      );
    },
  });

  const {
    data: answer,
    error: answerError,
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
        {
          type: "error",
        },
      );
    },
  });

  const selectedModel =
    aiConfig?.historicalAnalysisModel ?? defaultAnnualAnalysisModel;
  const trimmedQuestion = question.trim();
  const isCurrentYear = year === new Date().getFullYear();
  const suggestedQuestions = getAnnualOperationsSuggestedQuestions({
    year,
    isCurrentYear,
  });

  useEffect(() => {
    setQuestion("");
    resetSummary();
    resetAnswer();
  }, [year, resetAnswer, resetSummary]);

  const submitQuestion = (nextQuestion = question) => {
    const trimmed = nextQuestion.trim();
    if (!trimmed) {
      notify("Scrivi una domanda prima di inviare la richiesta.", {
        type: "warning",
      });
      return;
    }

    setQuestion(trimmed);
    askQuestion(trimmed);
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI: spiegami l'anno {year}
          </CardTitle>
          <Badge variant="outline">{selectedModel}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Legge la parte operativa dell'anno scelto: valore del lavoro,
          clienti, categorie, spese, margine lordo, pagamenti da ricevere e
          preventivi aperti. Non include il simulatore fiscale ne gli alert di
          oggi.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {summary ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{summary.model}</Badge>
              <span>Generata il {formatGeneratedAt(summary.generatedAt)}</span>
            </div>
            <Markdown className="text-sm leading-6 [&_h2]:mt-4 [&_h2]:text-sm [&_h2]:font-semibold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:font-semibold">
              {summary.summaryMarkdown}
            </Markdown>
          </div>
        ) : (
          <div className="rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
            Nessuna spiegazione generata. Usa il bottone qui sotto per farti
            spiegare l'andamento operativo dell'anno in italiano semplice.
          </div>
        )}

        {summaryError ? (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {summaryError.message}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            onClick={() => generateSummary()}
            disabled={isSummaryPending}
            className="gap-2"
          >
            {isSummaryPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {summary ? "Rigenera spiegazione" : "Spiegami Annuale"}
          </Button>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Oppure fai una domanda</p>
            <p className="text-xs text-muted-foreground">
              L'AI risponde usando solo i numeri operativi di Annuale. Se una
              cosa non e dimostrabile, te lo dice chiaramente e non tratta uno
              zero come un problema automatico.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="annual-ai-question">
              Fai una domanda su questo anno
            </Label>
            <Textarea
              id="annual-ai-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Per esempio: cosa sta trainando quest'anno?"
              maxLength={300}
              className="min-h-24"
            />
            <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
              <span>Massimo 300 caratteri.</span>
              <span>{trimmedQuestion.length}/300</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                variant="secondary"
                size="sm"
                disabled={isAnswerPending}
                onClick={() => submitQuestion(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>

          {answer ? (
            <div className="space-y-3 rounded-md border px-4 py-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{answer.model}</Badge>
                <span>
                  Risposta del {formatGeneratedAt(answer.generatedAt)}
                </span>
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="font-medium">Domanda:</span> {answer.question}
              </div>
              <Markdown className="text-sm leading-6 [&_h2]:mt-4 [&_h2]:text-sm [&_h2]:font-semibold [&_p]:mb-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:font-semibold">
                {answer.answerMarkdown}
              </Markdown>
            </div>
          ) : null}

          {answerError ? (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {answerError.message}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              onClick={() => submitQuestion()}
              disabled={isAnswerPending || !trimmedQuestion}
              className="gap-2"
            >
              {isAnswerPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {answer ? "Fai un'altra domanda" : "Chiedi all'AI"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
