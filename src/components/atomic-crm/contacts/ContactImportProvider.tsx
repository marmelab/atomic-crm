/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Form, useNotify, useRefresh, useTranslate } from "ra-core";
import { Link } from "react-router";
import { toast } from "sonner";

import { FileField } from "@/components/admin/file-field";
import { FileInput } from "@/components/admin/file-input";
import { FormToolbar } from "@/components/admin/simple-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

import { usePapaParse, type ImportState } from "../misc/usePapaParse";
import * as sampleCsv from "./contacts_export.csv?raw";
import { useContactImport, type ContactImportSchema } from "./useContactImport";

type ContactImportContextValue = {
  isImporting: boolean;
  openDialog(): void;
};

const ContactImportContext = createContext<
  ContactImportContextValue | undefined
>(undefined);

export const useContactImportContext = () => {
  const context = useContext(ContactImportContext);
  if (!context) {
    throw new Error(
      "useContactImportContext must be used inside a <ContactImportProvider>",
    );
  }
  return context;
};

export const ContactImportProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const processBatch = useContactImport();
  const { importer, parseCsv, reset } = usePapaParse<ContactImportSchema>({
    batchSize: 10,
    processBatch,
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (importer.state === "complete") {
      refresh();
      notify("resources.contacts.import.complete", {
        type: "success",
        messageArgs: {
          importCount: importer.importCount,
          errorCount: importer.errorCount,
        },
      });
    }
    if (importer.state === "error") {
      notify("resources.contacts.import.error", { type: "error" });
    }
  }, [importer, notify, refresh]);

  const isImporting =
    importer.state === "parsing" || importer.state === "running";

  useEffect(() => {
    if (!isImporting) return;

    const confirmLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", confirmLeave);
    return () => window.removeEventListener("beforeunload", confirmLeave);
  }, [isImporting]);

  const openDialog = useCallback(() => {
    if (importer.state === "complete" || importer.state === "error") {
      reset();
    }
    setIsDialogOpen(true);
  }, [importer.state, reset]);

  const startImport = (file: File) => {
    parseCsv(file);
    setIsDialogOpen(false);
  };

  const value = useMemo(
    () => ({ isImporting, openDialog }),
    [isImporting, openDialog],
  );

  return (
    <ContactImportContext.Provider value={value}>
      {children}
      <ContactImportDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onStart={startImport}
      />
      <ContactImportProgressToast importer={importer} onStop={reset} />
    </ContactImportContext.Provider>
  );
};

const SAMPLE_URL = `data:text/csv;name=crm_contacts_sample.csv;charset=utf-8,${encodeURIComponent(
  sampleCsv.default,
)}`;

const ContactImportDialog = ({
  open,
  onClose,
  onStart,
}: {
  open: boolean;
  onClose(): void;
  onStart(file: File): void;
}) => {
  const translate = useTranslate();
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (selected: File | null) => {
    setFile(selected);
  };

  const handleClose = () => {
    setFile(null);
    onClose();
  };

  const handleStartImport = () => {
    if (!file) return;
    setFile(null);
    onStart(file);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl">
        <Form className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {translate("resources.contacts.import.title")}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col space-y-2">
            <Alert>
              <AlertDescription className="flex flex-col gap-4">
                {translate("resources.contacts.import.sample_hint")}
                <Button asChild variant="outline" size="sm">
                  <Link to={SAMPLE_URL} download={"crm_contacts_sample.csv"}>
                    {translate("resources.contacts.import.sample_download")}
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>

            <FileInput
              source="csv"
              label="resources.contacts.import.csv_file"
              accept={{ "text/csv": [".csv"] }}
              onChange={handleFileChange}
            >
              <FileField source="src" title="title" target="_blank" />
            </FileInput>
          </div>
        </Form>

        <div className="flex justify-start pt-6">
          <FormToolbar>
            <Button onClick={handleStartImport} disabled={!file}>
              {translate("resources.contacts.import.button")}
            </Button>
          </FormToolbar>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const TOAST_ID = "contact-import-progress";

const ContactImportProgressToast = ({
  importer,
  onStop,
}: {
  importer: ImportState;
  onStop(): void;
}) => {
  const translate = useTranslate();

  const isImporting =
    importer.state === "parsing" || importer.state === "running";
  const hasProgress = importer.state === "running";
  const rowCount = importer.state === "running" ? importer.rowCount : 0;
  const importCount = importer.state === "running" ? importer.importCount : 0;
  const errorCount = importer.state === "running" ? importer.errorCount : 0;
  const remainingTime =
    importer.state === "running" ? importer.remainingTime : null;

  useEffect(() => {
    if (!isImporting) return;

    return () => {
      toast.dismiss(TOAST_ID);
    };
  }, [isImporting]);

  useEffect(() => {
    if (!isImporting) return;

    toast.custom(
      () => (
        <div className="bg-popover text-popover-foreground flex w-full flex-col gap-2 rounded-md border p-4 shadow-lg">
          <div className="flex flex-row items-start justify-between gap-4">
            <p className="text-sm font-medium">
              {translate("resources.contacts.import.in_progress")}
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={onStop}
              className="text-destructive h-auto p-0 text-xs"
            >
              {translate("resources.contacts.import.stop")}
            </Button>
          </div>
          {hasProgress && (
            <>
              <Progress
                value={rowCount ? (importCount / rowCount) * 100 : 0}
                aria-label={translate("resources.contacts.import.in_progress")}
              />
              <p className="text-muted-foreground text-xs">
                {translate("resources.contacts.import.progress", {
                  importCount,
                  rowCount,
                  errorCount,
                })}
                {remainingTime !== null && (
                  <>
                    {" "}
                    {translate("resources.contacts.import.remaining_time")}{" "}
                    <strong>{millisecondsToTime(remainingTime)}</strong>.
                  </>
                )}
              </p>
            </>
          )}
        </div>
      ),
      { id: TOAST_ID, duration: Infinity, position: "bottom-right" },
    );
  }, [
    isImporting,
    hasProgress,
    importCount,
    rowCount,
    errorCount,
    remainingTime,
    translate,
    onStop,
  ]);

  return null;
};

function millisecondsToTime(ms: number) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (60 * 1000)) % 60);

  return `${minutes}m ${seconds}s`;
}
