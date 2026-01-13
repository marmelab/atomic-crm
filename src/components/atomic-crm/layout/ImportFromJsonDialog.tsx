import React from "react";
import { AlertCircleIcon } from "lucide-react";
import { Form, required } from "ra-core";
import ms from "ms";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FileField, FileInput } from "@/components/admin";
import {
  type ImportFromJsonFailures,
  type ImportFromJsonStats,
  useImportFromJson,
} from "./useImportFromJson";

export const ImportFromJsonDialog = ({
  onOpenChange,
  ...props
}: React.ComponentProps<typeof Dialog>) => {
  const [importStatus, importFile, reset] = useImportFromJson();

  return (
    <Dialog
      onOpenChange={(open) => {
        if (importStatus.status !== "importing") {
          reset();
          if (onOpenChange) {
            onOpenChange(open);
          }
        }
      }}
      {...props}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from JSON</DialogTitle>
        </DialogHeader>
        {importStatus.status === "idle" || importStatus.status === "error" ? (
          <Form
            onSubmit={(values: any) => {
              importFile(values.file.rawFile);
            }}
          >
            {importStatus.status === "error" ? (
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>Unable to import this file.</AlertTitle>
                <AlertDescription>
                  <p>{importStatus.error.message}</p>
                  <p>Duration: {ms(importStatus.duration, { long: true })}</p>
                </AlertDescription>
                <DownloadErrorFileButton
                  failedImports={importStatus.failedImports}
                />
              </Alert>
            ) : null}
            <FileInput source="file" validate={required()}>
              <FileField source="src" title="title" />
            </FileInput>
            <DialogFooter>
              <Button type="submit">Import</Button>
              <DialogClose asChild>
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </DialogClose>
            </DialogFooter>
          </Form>
        ) : (
          <>
            {importStatus.status === "importing" ? (
              <Alert>
                <AlertTitle>Importing data...</AlertTitle>
                <AlertDescription>
                  Do not close this browser tab
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <AlertTitle>Imported data</AlertTitle>
                <AlertDescription>
                  <p>
                    You can now safely close this browser tab or the dialog.
                  </p>
                  {hasFailedImports(importStatus.failedImports) ? (
                    <>
                      <p>Some records were not imported.</p>
                      <DownloadErrorFileButton
                        failedImports={importStatus.failedImports}
                      />
                    </>
                  ) : null}
                  <p>Duration: {ms(importStatus.duration, { long: true })}</p>
                </AlertDescription>
              </Alert>
            )}
            <ImportStats
              stats={importStatus.stats}
              failedImports={importStatus.failedImports}
            />
            {importStatus.status === "success" ? (
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" type="button">
                    Close
                  </Button>
                </DialogClose>
              </DialogFooter>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

const hasFailedImports = (failedImports: ImportFromJsonFailures) => {
  return (
    failedImports.sales.length > 0 ||
    failedImports.companies.length > 0 ||
    failedImports.contacts.length > 0 ||
    failedImports.notes.length > 0 ||
    failedImports.tasks.length > 0
  );
};

const DownloadErrorFileButton = ({
  failedImports,
}: {
  failedImports: ImportFromJsonFailures;
}) => {
  return (
    <a
      href={`data:application/json,${JSON.stringify(failedImports)}`}
      download="invalid-import-data.json"
    >
      Download the error report
    </a>
  );
};

const ImportStats = ({
  stats,
  failedImports,
}: {
  stats: ImportFromJsonStats;
  failedImports: ImportFromJsonFailures;
}) => (
  <ul>
    <ImportStat
      label="Sales"
      imported={stats.sales}
      failed={failedImports.sales.length}
    />
    <ImportStat
      label="Companies"
      imported={stats.companies}
      failed={failedImports.companies.length}
    />
    <ImportStat
      label="Contacts"
      imported={stats.contacts}
      failed={failedImports.contacts.length}
    />
    <ImportStat
      label="Notes"
      imported={stats.notes}
      failed={failedImports.notes.length}
    />
    <ImportStat
      label="Tasks"
      imported={stats.tasks}
      failed={failedImports.tasks.length}
    />
  </ul>
);

const ImportStat = ({
  label,
  imported,
  failed,
}: {
  label: string;
  imported: number;
  failed: number;
}) => (
  <li>
    <span className="mr-1">{label}:</span>
    <span className="inline-flex gap-1">
      <span>{imported.toString()}</span>
      <span>/</span>
      <span className="text-destructive">{failed.toString()}</span>
    </span>
  </li>
);
