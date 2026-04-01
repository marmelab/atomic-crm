import { CheckCircle2, FileUp, Loader2, SendHorizontal } from "lucide-react";
import type { ChangeEventHandler, RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  InvoiceImportConfirmation,
  InvoiceImportDraft,
  InvoiceImportWorkspace,
} from "@/lib/ai/invoiceImport";

import { AiDraftSummaryBar } from "./AiDraftSummaryBar";
import { AiStatusCallout } from "./AiStatusCallout";
import { InvoiceImportDraftEditor } from "./InvoiceImportDraftEditor";

const buildDraftSummaryGroups = (draft: InvoiceImportDraft) => {
  const groupMap: Record<
    string,
    { resource: string; label: string; count: number; total: number }
  > = {};

  for (const record of draft.records) {
    const resource = record.resource ?? "expenses";
    if (!groupMap[resource]) {
      groupMap[resource] = {
        resource,
        label:
          resource === "payments"
            ? "incassi"
            : resource === "services"
              ? "servizi"
              : "spese",
        count: 0,
        total: 0,
      };
    }
    groupMap[resource].count += 1;
    groupMap[resource].total += Number(record.amount) || 0;
  }

  return Object.values(groupMap);
};

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

export const AiInvoiceImportView = ({
  fileInputRef,
  selectedFiles,
  userInstructions,
  onUserInstructionsChange,
  onFileSelection,
  onRemoveSelectedFile,
  onAnalyze,
  isExtractPending,
  draft,
  submittedFiles,
  workspace,
  workspaceError,
  isWorkspacePending,
  onDraftChange,
  onDraftRemove,
  hasBlockingErrors,
  onConfirm,
  isConfirmPending,
  confirmation,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  selectedFiles: File[];
  userInstructions: string;
  onUserInstructionsChange: (value: string) => void;
  onFileSelection: ChangeEventHandler<HTMLInputElement>;
  onRemoveSelectedFile: (fileName: string) => void;
  onAnalyze: () => void;
  isExtractPending: boolean;
  draft: InvoiceImportDraft | null;
  submittedFiles: string[];
  workspace?: InvoiceImportWorkspace;
  workspaceError: unknown;
  isWorkspacePending: boolean;
  onDraftChange: (index: number, patch: Record<string, unknown>) => void;
  onDraftRemove: (index: number) => void;
  hasBlockingErrors: boolean;
  onConfirm: () => void;
  isConfirmPending: boolean;
  confirmation: InvoiceImportConfirmation | null;
}) => (
  <div className="space-y-4">
    <div className="rounded-2xl border bg-primary/5 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
          <FileUp className="size-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">Importa fatture e ricevute</p>
          <p className="text-sm text-muted-foreground">
            Carica PDF, scansioni o foto. L&apos;AI prepara una bozza
            strutturata per incassi, spese o servizi, che puoi correggere prima
            della conferma.
          </p>
        </div>
      </div>
    </div>

    <div className="rounded-2xl border bg-background p-4 shadow-sm">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invoice-import-files">Documenti</Label>
          <Input
            id="invoice-import-files"
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf,image/*"
            onChange={onFileSelection}
          />
          <p className="text-xs text-muted-foreground">
            PDF, scansioni e foto · max 6 file · max 20 MB ciascuno
          </p>
        </div>

        {selectedFiles.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file) => (
              <button
                key={file.name}
                type="button"
                onClick={() => onRemoveSelectedFile(file.name)}
                className="rounded-full border bg-muted/30 px-3 py-1 text-xs"
              >
                {file.name}
              </button>
            ))}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="invoice-import-instructions">
            Istruzioni opzionali
          </Label>
          <Textarea
            id="invoice-import-instructions"
            value={userInstructions}
            onChange={(event) => onUserInstructionsChange(event.target.value)}
            placeholder="Esempio: la prima e' una fattura cliente, la seconda e' un costo fornitore."
            className="min-h-24"
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            onClick={onAnalyze}
            disabled={isExtractPending || selectedFiles.length === 0}
            className="gap-2"
          >
            {isExtractPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileUp className="size-4" />
            )}
            Analizza documenti
          </Button>
        </div>
      </div>
    </div>

    {workspaceError ? (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Impossibile leggere il workspace CRM per il match clienti/progetti.
      </div>
    ) : null}

    {submittedFiles.length > 0 ? (
      <div className="rounded-2xl border bg-muted/20 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-secondary p-2 text-secondary-foreground">
            <SendHorizontal className="size-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Tu</p>
            <p className="text-sm text-muted-foreground">
              Ho caricato: {submittedFiles.join(", ")}
            </p>
            {userInstructions.trim() ? (
              <p className="text-sm text-muted-foreground">
                Nota: {userInstructions.trim()}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    ) : null}

    {draft ? (
      <div className="rounded-2xl border bg-background px-4 py-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
            <FileUp className="size-4" />
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Assistente</p>
              <p className="text-sm text-muted-foreground">{draft.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Generata il {formatGeneratedAt(draft.generatedAt)}
              </p>
            </div>

            {draft.warnings.length > 0 ? (
              <AiStatusCallout tone="warning" title="Controlli richiesti">
                <ul className="list-disc space-y-1 pl-5">
                  {draft.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </AiStatusCallout>
            ) : null}
          </div>
        </div>
      </div>
    ) : null}

    {isWorkspacePending ? (
      <div className="rounded-2xl border border-dashed px-4 py-4 text-sm text-muted-foreground">
        Sto caricando clienti e progetti per il match CRM...
      </div>
    ) : null}

    {draft && workspace ? (
      <>
        <AiDraftSummaryBar
          groups={buildDraftSummaryGroups(draft)}
          totalRecords={draft.records.length}
        />

        <InvoiceImportDraftEditor
          draft={draft}
          workspace={workspace}
          onChange={onDraftChange}
          onRemove={onDraftRemove}
        />

        <div className="rounded-2xl border bg-muted/20 px-4 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Conferma import</p>
              <p className="text-sm text-muted-foreground">
                Record pronti: {draft.records.length}.{" "}
                {hasBlockingErrors
                  ? "Correggi i campi mancanti prima di confermare."
                  : "La bozza e' pronta per essere salvata nel CRM."}
              </p>
            </div>

            <Button
              type="button"
              onClick={onConfirm}
              disabled={
                isConfirmPending ||
                draft.records.length === 0 ||
                hasBlockingErrors
              }
              className="gap-2"
            >
              {isConfirmPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Conferma import nel CRM
            </Button>
          </div>
        </div>
      </>
    ) : null}

    {confirmation ? (
      <div className="space-y-3">
        {confirmation.created.length > 0 ? (
          <AiStatusCallout
            tone="success"
            title={`Import completato — ${confirmation.created.length} record creati`}
          >
            <ul className="list-disc space-y-1 pl-5">
              {confirmation.created.map((item) => (
                <li key={`${item.resource}-${item.id}`}>
                  {item.resource === "payments"
                    ? "Pagamento"
                    : item.resource === "services"
                      ? "Servizio"
                      : "Spesa"}{" "}
                  creat
                  {item.resource === "expenses" ? "a" : "o"} con ID{" "}
                  {String(item.id)}
                  {item.invoiceRef ? ` · rif. ${item.invoiceRef}` : ""}
                </li>
              ))}
            </ul>
          </AiStatusCallout>
        ) : null}
        {confirmation.skipped?.length ? (
          <AiStatusCallout
            tone="warning"
            title={`${confirmation.skipped.length} record saltati (gia presenti)`}
          >
            <ul className="list-disc space-y-1 pl-5">
              {confirmation.skipped.map((item, i) => (
                <li key={`skipped-${i}`}>
                  {item.description ?? item.reason}
                  {item.amount != null ? ` · €${item.amount}` : ""}
                </li>
              ))}
            </ul>
          </AiStatusCallout>
        ) : null}
      </div>
    ) : null}
  </div>
);
