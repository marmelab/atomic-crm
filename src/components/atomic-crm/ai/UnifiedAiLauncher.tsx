import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDataProvider, useNotify } from "ra-core";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  applyInvoiceImportWorkspaceHints,
  getInvoiceImportRecordValidationErrors,
  normalizeInvoiceImportDraft,
  type InvoiceImportConfirmation,
  type InvoiceImportDraft,
} from "@/lib/ai/invoiceImport";
import type {
  UnifiedCrmAnswer,
  UnifiedCrmConversationTurn,
  UnifiedCrmPaymentDraft,
} from "@/lib/ai/unifiedCrmAssistant";
import { cn } from "@/lib/utils";

import { AiChatView } from "./AiChatView";
import { AiInvoiceImportView } from "./AiInvoiceImportView";
import {
  AiLauncherHeader,
  type UnifiedAiLauncherView,
} from "./AiLauncherHeader";
import { UnifiedCrmReadSnapshot } from "./UnifiedCrmReadSnapshot";
import type { CrmDataProvider } from "../providers/types";
import { useConfigurationContext } from "../root/ConfigurationContext";

export const UnifiedAiLauncher = () => {
  const [open, setOpen] = useState(false);
  const [activeView, setActiveView] = useState<UnifiedAiLauncherView>("chat");
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatAnswer, setChatAnswer] = useState<UnifiedCrmAnswer | null>(null);
  const [chatConversationHistory, setChatConversationHistory] = useState<
    UnifiedCrmConversationTurn[]
  >([]);
  const [chatPaymentDraft, setChatPaymentDraft] =
    useState<UnifiedCrmPaymentDraft | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [userInstructions, setUserInstructions] = useState("");
  const [draft, setDraft] = useState<InvoiceImportDraft | null>(null);
  const [submittedFiles, setSubmittedFiles] = useState<string[]>([]);
  const [confirmation, setConfirmation] =
    useState<InvoiceImportConfirmation | null>(null);
  const isMobile = useIsMobile();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const { aiConfig } = useConfigurationContext();

  const {
    data: workspace,
    error: workspaceError,
    isPending: isWorkspacePending,
  } = useQuery({
    queryKey: ["invoice-import-workspace"],
    queryFn: () => dataProvider.getInvoiceImportWorkspace(),
    enabled: open,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const {
    data: readContext,
    error: readContextError,
    isPending: isReadContextPending,
  } = useQuery({
    queryKey: ["unified-crm-read-context"],
    queryFn: () => dataProvider.getUnifiedCrmReadContext(),
    enabled: open,
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const extractMutation = useMutation({
    mutationKey: ["invoice-import-extract"],
    mutationFn: async () => {
      if (selectedFiles.length === 0) {
        throw new Error(
          "Carica almeno un PDF o una scansione prima di analizzare.",
        );
      }

      const uploadedFiles =
        await dataProvider.uploadInvoiceImportFiles(selectedFiles);

      return dataProvider.generateInvoiceImportDraft({
        files: uploadedFiles,
        userInstructions: userInstructions.trim() || null,
      });
    },
    onSuccess: (nextDraft) => {
      const normalizedDraft = normalizeInvoiceImportDraft(nextDraft);
      setDraft(applyInvoiceImportWorkspaceHints(normalizedDraft, workspace));
      setSubmittedFiles(selectedFiles.map((file) => file.name));
      setConfirmation(null);
      notify(
        "Bozza fatture generata. Controlla e correggi prima di confermare.",
        {
          type: "success",
        },
      );
    },
    onError: (error: Error) => {
      notify(
        error.message || "Impossibile analizzare i documenti nella chat AI.",
        { type: "error" },
      );
    },
  });

  const confirmMutation = useMutation({
    mutationKey: ["invoice-import-confirm"],
    mutationFn: async () => {
      if (!draft) {
        throw new Error("Non c'e' nessuna bozza da confermare.");
      }

      return dataProvider.confirmInvoiceImportDraft(draft);
    },
    onSuccess: (result) => {
      setConfirmation(result);
      const skippedCount = result.skipped?.length ?? 0;
      const createdCount = result.created.length;
      const message =
        skippedCount > 0
          ? `Import completato: ${createdCount} creati, ${skippedCount} saltati (duplicati).`
          : `Import completato: ${createdCount} record creati.`;
      notify(message, { type: skippedCount > 0 ? "warning" : "success" });
    },
    onError: (error: Error) => {
      notify(
        error.message || "Impossibile confermare l'import fatture nel CRM.",
        { type: "error" },
      );
    },
  });

  const resetImportWorkspace = () => {
    setSelectedFiles([]);
    setUserInstructions("");
    setDraft(null);
    setSubmittedFiles([]);
    setConfirmation(null);
    extractMutation.reset();
    confirmMutation.reset();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const blockingErrors = useMemo(
    () =>
      draft?.records.flatMap((record) =>
        getInvoiceImportRecordValidationErrors(record, workspace),
      ) ?? [],
    [draft, workspace],
  );

  const hasBlockingErrors = blockingErrors.length > 0;
  const selectedAnswerModel = aiConfig?.historicalAnalysisModel ?? "gpt-5.2";
  const canResetChat =
    chatAnswer !== null ||
    chatConversationHistory.length > 0 ||
    chatQuestion.trim().length > 0 ||
    chatPaymentDraft !== null;
  const canResetImport =
    selectedFiles.length > 0 ||
    draft !== null ||
    confirmation !== null ||
    submittedFiles.length > 0;

  const resetChat = () => {
    setChatQuestion("");
    setChatAnswer(null);
    setChatConversationHistory([]);
    setChatPaymentDraft(null);
  };

  const onFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFiles = Array.from(event.target.files ?? []);
    setSelectedFiles(nextFiles);
    setDraft(null);
    setConfirmation(null);
    setSubmittedFiles([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeSelectedFile = (fileName: string) => {
    setSelectedFiles((current) =>
      current.filter((file) => file.name !== fileName),
    );
    setDraft(null);
    setConfirmation(null);
    setSubmittedFiles([]);
  };

  const updateDraftRecord = (index: number, patch: Record<string, unknown>) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      const nextRecords = [...current.records];
      nextRecords[index] = {
        ...nextRecords[index],
        ...patch,
      };

      const nextDraft = {
        ...current,
        records: nextRecords,
      };

      return applyInvoiceImportWorkspaceHints(nextDraft, workspace);
    });
    setConfirmation(null);
  };

  const removeDraftRecord = (index: number) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        records: current.records.filter(
          (_, recordIndex) => recordIndex !== index,
        ),
      };
    });
    setConfirmation(null);
  };

  useEffect(() => {
    if (!workspace) {
      return;
    }

    setDraft((current) =>
      current ? applyInvoiceImportWorkspaceHints(current, workspace) : current,
    );
  }, [workspace]);

  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
    >
      <SheetTrigger asChild>
        <Button
          type="button"
          size="icon"
          className={cn(
            "fixed z-40 size-12 rounded-full shadow-lg",
            "border border-primary/20 bg-primary text-primary-foreground",
            "hover:bg-primary/90",
            isMobile ? "bottom-20 left-4" : "bottom-6 right-6",
          )}
          aria-label="Apri chat AI unificata"
        >
          <Bot className="size-5" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "min-h-0 overflow-hidden gap-0 p-0",
          isMobile
            ? "inset-0 h-dvh max-h-dvh rounded-none border-t-0"
            : "w-full sm:max-w-2xl",
        )}
      >
        <AiLauncherHeader
          activeView={activeView}
          onViewChange={setActiveView}
          canResetChat={activeView === "chat" && canResetChat}
          onResetChat={resetChat}
          canResetImport={activeView === "import" && canResetImport}
          onResetImport={resetImportWorkspace}
          canCopyAnswer={activeView === "chat" && chatAnswer !== null}
          answerMarkdown={chatAnswer?.answerMarkdown}
        />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            className={cn(
              "h-full min-h-0",
              activeView === "chat"
                ? "overflow-hidden"
                : "overflow-y-auto px-3 py-3",
            )}
          >
            <div className={cn("h-full", activeView !== "chat" && "hidden")}>
              <AiChatView
                context={readContext ?? null}
                selectedModel={selectedAnswerModel}
                isReadContextPending={isReadContextPending && open}
                readContextError={readContextError}
                question={chatQuestion}
                onQuestionChange={setChatQuestion}
                answer={chatAnswer}
                onAnswerChange={(nextAnswer) => {
                  setChatAnswer(nextAnswer);
                  if (!nextAnswer) {
                    setChatConversationHistory([]);
                    return;
                  }

                  setChatConversationHistory((current) => [
                    ...current,
                    {
                      question: nextAnswer.question,
                      answerMarkdown: nextAnswer.answerMarkdown,
                      generatedAt: nextAnswer.generatedAt,
                      model: nextAnswer.model,
                    },
                  ]);
                }}
                paymentDraft={chatPaymentDraft}
                onPaymentDraftChange={setChatPaymentDraft}
                conversationHistory={chatConversationHistory}
                onNavigate={() => setOpen(false)}
                onOpenView={setActiveView}
              />
            </div>

            {activeView === "snapshot" ? (
              isReadContextPending && open ? (
                <div className="rounded-2xl border border-dashed px-4 py-4 text-sm text-muted-foreground">
                  Sto leggendo il contesto CRM unificato...
                </div>
              ) : readContextError ? (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  Impossibile leggere la snapshot CRM del launcher unificato.
                </div>
              ) : readContext ? (
                <UnifiedCrmReadSnapshot context={readContext} />
              ) : null
            ) : null}

            {activeView === "import" ? (
              <AiInvoiceImportView
                fileInputRef={fileInputRef}
                selectedFiles={selectedFiles}
                userInstructions={userInstructions}
                onUserInstructionsChange={setUserInstructions}
                onFileSelection={onFileSelection}
                onRemoveSelectedFile={removeSelectedFile}
                onAnalyze={() => extractMutation.mutate()}
                isExtractPending={extractMutation.isPending}
                draft={draft}
                submittedFiles={submittedFiles}
                workspace={workspace}
                workspaceError={workspaceError}
                isWorkspacePending={isWorkspacePending && open}
                onDraftChange={updateDraftRecord}
                onDraftRemove={removeDraftRecord}
                hasBlockingErrors={hasBlockingErrors}
                onConfirm={() => confirmMutation.mutate()}
                isConfirmPending={confirmMutation.isPending}
                confirmation={confirmation}
              />
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
