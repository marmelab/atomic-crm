import { Form, required } from "ra-core";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileField, FileInput } from "@/components/admin";
import {
  type ImportFromHighriseFailures,
  type ImportFromHighriseStats,
  useImportFromHighrise,
} from "./useImportFromHighrise";
import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";

export const ImportFromHighriseDialog = (
  props: React.ComponentProps<typeof Dialog>,
) => {
  const [importStatus, importFile] = useImportFromHighrise();

  return (
    <Dialog {...props}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from Highrise</DialogTitle>
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
                  {importStatus.error.message}
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
                    Cancel
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

const hasFailedImports = (failedImports: ImportFromHighriseFailures) => {
  return (
    failedImports.sales.length > 0 ||
    failedImports.companies.length > 0 ||
    failedImports.contacts.length > 0 ||
    failedImports.notes.length > 0 ||
    failedImports.tasks.length > 0
  );
};

const encodeJSONToBase64 = (data: Record<string, unknown>) => {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const binString = Array.from(bytes, (byte) =>
    String.fromCodePoint(byte),
  ).join("");
  return btoa(binString);
};

const DownloadErrorFileButton = ({
  failedImports,
}: {
  failedImports: ImportFromHighriseFailures;
}) => {
  return (
    <a
      href={`data:text/plain;base64,:${encodeJSONToBase64(failedImports)}`}
      download
    >
      Download the error report
    </a>
  );
};

const ImportStats = ({
  stats,
  failedImports,
}: {
  stats: ImportFromHighriseStats;
  failedImports: ImportFromHighriseFailures;
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
