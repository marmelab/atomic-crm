import { useState } from "react";
import { useDataProvider } from "ra-core";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Loader2,
  MinusCircle,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/components/atomic-crm/providers/supabase/supabase";
import { Badge } from "@/components/ui/badge";
import {
  buildPipelineStepViews,
  formatDurationMs,
  summarizePipeline,
  type PipelineStepStatus,
  type PipelineStepView,
  type RawPipelineStepRow,
} from "./quotePipeline";

/**
 * Phase 7 — visual pipeline view for a single quote.
 *
 * Reads quote_pipeline_steps via the dataProvider and renders a compact
 * horizontal stepper with one card per canonical step. Default collapsed
 * so the pipeline section does not dominate QuoteShow; sellers click the
 * summary header to expand full details. Auto-polls every 3 seconds
 * while any step is in `running` status, stops polling once the whole
 * pipeline has settled.
 *
 * This component intentionally avoids react-flow or other node-graph
 * libraries — the flow is linear and read-only, so flexbox + Tailwind
 * classes give us the n8n feel with zero new dependencies.
 */

interface QuotePipelineViewProps {
  quoteId: number | string;
}

const POLL_INTERVAL_MS = 3000;

/** Steps that can be retried from the UI, matching the backend RETRY_GUARD. */
const RETRYABLE_STEPS = new Set([
  "generate_pdf",
  "docuseal_submit",
  "send_email",
]);

export const QuotePipelineView = ({ quoteId }: QuotePipelineViewProps) => {
  const dataProvider = useDataProvider();
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [retryingStep, setRetryingStep] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryInfo, setRetryInfo] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["quote_pipeline_steps", quoteId],
    queryFn: async () => {
      const rows = (await dataProvider.getQuotePipelineSteps(
        quoteId,
      )) as RawPipelineStepRow[];
      return buildPipelineStepViews(rows);
    },
    refetchInterval: (query) => {
      const views = query.state.data as PipelineStepView[] | undefined;
      if (!views) return false;
      const anyRunning = views.some((v) => v.status === "running");
      return anyRunning ? POLL_INTERVAL_MS : false;
    },
    staleTime: 1000,
  });

  const views = data ?? [];
  const summary = summarizePipeline(views);

  // Hide the whole section when we have no pipeline data at all — there
  // is nothing to show for quotes created before Phase 1 or for quotes
  // that have not been orchestrated yet.
  const hasAnyActivity = views.some((v) => v.status !== "pending");
  if (!isLoading && !isError && !hasAnyActivity) {
    return null;
  }

  return (
    <div className="mx-4 my-3 rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent/40 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium">Pipeline</span>
          {isLoading ? (
            <span className="text-xs text-muted-foreground">Loading…</span>
          ) : isError ? (
            <span className="text-xs text-destructive">
              Failed to load: {(error as Error)?.message ?? "unknown"}
            </span>
          ) : (
            <PipelineHeadlineBadge summary={summary} />
          )}
        </div>
        {summary.isRunning && (
          <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />
        )}
      </button>

      {isExpanded && !isLoading && !isError && (
        <div className="border-t px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {views.map((view, index) => (
              <PipelineStepCard
                key={view.stepName}
                view={view}
                isExpanded={expandedStep === view.stepName}
                onToggle={() =>
                  setExpandedStep((cur) =>
                    cur === view.stepName ? null : view.stepName,
                  )
                }
                isLast={index === views.length - 1}
                isRetrying={retryingStep === view.stepName}
                retryError={
                  retryingStep === null && expandedStep === view.stepName
                    ? retryError
                    : null
                }
                retryInfo={
                  retryingStep === null && expandedStep === view.stepName
                    ? retryInfo
                    : null
                }
                onRetry={
                  view.status === "failed" && RETRYABLE_STEPS.has(view.stepName)
                    ? async () => {
                        setRetryingStep(view.stepName);
                        setRetryError(null);
                        setRetryInfo(null);
                        try {
                          const { data, error } =
                            await supabase.functions.invoke(
                              "retry_quote_step",
                              {
                                body: {
                                  quote_id: quoteId,
                                  step_name: view.stepName,
                                },
                              },
                            );
                          if (error) throw error;
                          // Surface skipped result (e.g. email already sent for this signing URL)
                          if (
                            data?.result?.skipped &&
                            view.stepName === "send_email"
                          ) {
                            setRetryInfo(
                              `Mailet är redan skickat (${data.result.reason ?? "already_sent"}) — ingen åtgärd togs`,
                            );
                          }
                          await refetch();
                        } catch (err) {
                          setRetryError(
                            err instanceof Error
                              ? err.message
                              : "Retry failed — check logs",
                          );
                        } finally {
                          setRetryingStep(null);
                        }
                      }
                    : undefined
                }
              />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Auto-refresh: {summary.isRunning ? "on (3s)" : "off"}</span>
            <button
              type="button"
              onClick={() => refetch()}
              className="underline-offset-2 hover:underline"
            >
              Refresh now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const PipelineHeadlineBadge = ({
  summary,
}: {
  summary: ReturnType<typeof summarizePipeline>;
}) => {
  const variant: "default" | "destructive" | "secondary" | "outline" =
    summary.failedStep
      ? "destructive"
      : summary.runningStep
        ? "default"
        : summary.latestCompletedStep
          ? "secondary"
          : "outline";
  return (
    <Badge variant={variant} className="text-xs font-normal truncate">
      {summary.headline}
    </Badge>
  );
};

interface PipelineStepCardProps {
  view: PipelineStepView;
  isExpanded: boolean;
  onToggle: () => void;
  isLast: boolean;
  isRetrying?: boolean;
  retryError?: string | null;
  retryInfo?: string | null;
  onRetry?: () => Promise<void>;
}

const PipelineStepCard = ({
  view,
  isExpanded,
  onToggle,
  isRetrying,
  retryError,
  retryInfo,
  onRetry,
}: PipelineStepCardProps) => {
  const canExpand =
    view.status === "failed" ||
    view.status === "running" ||
    view.status === "success";

  return (
    <div className="flex-1 min-w-[140px] max-w-[200px]">
      <button
        type="button"
        onClick={canExpand ? onToggle : undefined}
        disabled={!canExpand}
        className={[
          "w-full text-left rounded-md border px-2.5 py-2 transition-colors",
          statusBorderClass(view.status),
          statusBgClass(view.status),
          canExpand ? "hover:brightness-95 cursor-pointer" : "cursor-default",
        ].join(" ")}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <StatusIcon status={isRetrying ? "running" : view.status} />
          <span className="text-xs font-medium truncate">{view.label}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{formatDurationMs(view.durationMs)}</span>
          {view.attemptCount > 1 && (
            <span title="attempts">×{view.attemptCount}</span>
          )}
        </div>
      </button>

      {isExpanded && canExpand && (
        <div className="mt-1.5 rounded-md border bg-muted/30 p-2.5 text-xs space-y-1.5">
          {view.startedAt && (
            <div>
              <span className="text-muted-foreground">Started: </span>
              <span className="font-mono">
                {new Date(view.startedAt).toLocaleString("sv-SE")}
              </span>
            </div>
          )}
          {view.completedAt && (
            <div>
              <span className="text-muted-foreground">Completed: </span>
              <span className="font-mono">
                {new Date(view.completedAt).toLocaleString("sv-SE")}
              </span>
            </div>
          )}
          {view.errorMessage && (
            <div>
              <div className="text-destructive font-medium">Error</div>
              <div className="mt-0.5 whitespace-pre-wrap break-words text-destructive/90">
                {view.errorMessage}
              </div>
            </div>
          )}
          {view.errorDetails && (
            <details>
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Error details
              </summary>
              <pre className="mt-1 overflow-auto text-[10px] bg-background/50 rounded p-1.5 max-h-40">
                {JSON.stringify(view.errorDetails, null, 2)}
              </pre>
            </details>
          )}
          {view.metadata && Object.keys(view.metadata).length > 0 && (
            <details>
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Metadata
              </summary>
              <pre className="mt-1 overflow-auto text-[10px] bg-background/50 rounded p-1.5 max-h-40">
                {JSON.stringify(view.metadata, null, 2)}
              </pre>
            </details>
          )}
          {onRetry && (
            <div className="pt-0.5">
              <button
                type="button"
                onClick={onRetry}
                disabled={isRetrying}
                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isRetrying ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3" />
                )}
                {isRetrying ? "Retrying…" : "Retry"}
              </button>
              {retryError && (
                <div className="mt-1 text-destructive/80 text-[10px] whitespace-pre-wrap break-words">
                  {retryError}
                </div>
              )}
              {retryInfo && !retryError && (
                <div className="mt-1 text-amber-600/80 text-[10px] whitespace-pre-wrap break-words">
                  {retryInfo}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StatusIcon = ({ status }: { status: PipelineStepStatus }) => {
  const common = "w-3.5 h-3.5 shrink-0";
  switch (status) {
    case "success":
      return <CheckCircle2 className={`${common} text-green-600`} />;
    case "running":
      return <Loader2 className={`${common} text-blue-500 animate-spin`} />;
    case "failed":
      return <AlertCircle className={`${common} text-red-600`} />;
    case "skipped":
      return <MinusCircle className={`${common} text-yellow-600`} />;
    case "pending":
    default:
      return <Circle className={`${common} text-muted-foreground`} />;
  }
};

function statusBorderClass(status: PipelineStepStatus): string {
  switch (status) {
    case "success":
      return "border-green-300 dark:border-green-800";
    case "running":
      return "border-blue-300 dark:border-blue-800";
    case "failed":
      return "border-red-300 dark:border-red-800";
    case "skipped":
      return "border-yellow-300 dark:border-yellow-800";
    case "pending":
    default:
      return "border-border";
  }
}

function statusBgClass(status: PipelineStepStatus): string {
  switch (status) {
    case "success":
      return "bg-green-50 dark:bg-green-950/40";
    case "running":
      return "bg-blue-50 dark:bg-blue-950/40";
    case "failed":
      return "bg-red-50 dark:bg-red-950/40";
    case "skipped":
      return "bg-yellow-50 dark:bg-yellow-950/40";
    case "pending":
    default:
      return "bg-muted/30";
  }
}
