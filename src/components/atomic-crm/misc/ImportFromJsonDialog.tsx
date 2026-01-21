import React from "react";
import { AlertCircleIcon } from "lucide-react";
import { Form, required } from "ra-core";
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
  type ImportFromJsonErrorState,
  type ImportFromJsonFailures,
  type ImportFromJsonFunction,
  type ImportFromJsonState,
  useImportFromJson,
} from "./useImportFromJson";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import sampleFile from "./import-sample.json?url";

export const ImportFromJsonDialog = ({
  onOpenChange,
  ...props
}: React.ComponentProps<typeof Dialog>) => {
  const [importState, importFile, reset] = useImportFromJson();

  return (
    <Dialog
      onOpenChange={(open) => {
        if (importState.status !== "importing") {
          // If the import isn't running, reset its state so that users
          // may import another file after either a successful or failed import.
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
        {importState.status === "idle" ? (
          <ImportFromJsonIdle importFile={importFile} />
        ) : importState.status === "error" ? (
          <ImportFromJsonError
            importState={importState}
            importFile={importFile}
          />
        ) : importState.status === "importing" ? (
          <ImportFromJsonStatus importState={importState} />
        ) : (
          <ImportFromJsonSuccess importState={importState} />
        )}
      </DialogContent>
    </Dialog>
  );
};

const ImportFromJsonIdle = ({
  importFile,
}: {
  importFile: ImportFromJsonFunction;
}) => (
  <>
    <Alert>
      <AlertTitle>Instructions</AlertTitle>
      <AlertDescription>
        Provide a JSON file containing sales, companies, contacts, notes or
        tasks
        <a
          className="font-bold hover:underline"
          download="import-sample.json"
          href={sampleFile}
        >
          Download a sample
        </a>
      </AlertDescription>
    </Alert>
    <ImportFromJsonForm importFile={importFile} />
  </>
);

const ImportFromJsonError = ({
  importState,
  importFile,
}: {
  importFile: ImportFromJsonFunction;
  importState: ImportFromJsonErrorState;
}) => (
  <>
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>Unable to import this file.</AlertTitle>
      <AlertDescription>
        <p>{importState.error.message}</p>
      </AlertDescription>
    </Alert>
    <ImportFromJsonForm importFile={importFile} />
  </>
);

const ImportFromJsonForm = ({
  importFile,
}: {
  importFile: ImportFromJsonFunction;
}) => (
  <Form
    onSubmit={(values: any) => {
      importFile(values.file.rawFile);
    }}
  >
    <FileInput className="mt-4" source="file" validate={required()}>
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
);

const ImportFromJsonStatus = ({
  importState,
}: {
  importState: ImportFromJsonState;
}) => (
  <>
    <Alert>
      <AlertTitle>
        <Spinner /> Importing data...
      </AlertTitle>
      <AlertDescription>Do not close this browser tab</AlertDescription>
    </Alert>
    <ImportStats importState={importState} />
  </>
);

const ImportFromJsonSuccess = ({
  importState,
}: {
  importState: ImportFromJsonState;
}) => (
  <>
    <Alert>
      <AlertTitle>Imported data</AlertTitle>
      <AlertDescription>
        <p>You can now safely close this browser tab or the dialog.</p>
        {hasFailedImports(importState.failedImports) ? (
          <>
            <p className="text-destructive">Some records were not imported.</p>
            <DownloadErrorFileButton
              failedImports={importState.failedImports}
            />
          </>
        ) : null}
      </AlertDescription>
    </Alert>
    <ImportStats importState={importState} />
    <DialogFooter>
      <DialogClose asChild>
        <Button variant="outline" type="button">
          Close
        </Button>
      </DialogClose>
    </DialogFooter>
  </>
);

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
      className="font-semibold"
    >
      Download the error report
    </a>
  );
};

const ImportStats = ({
  importState: { stats, failedImports },
}: {
  importState: ImportFromJsonState;
}) => {
  const data = [
    {
      entity: "sales",
      imported: stats.sales,
      failed: failedImports.sales.length,
    },
    {
      entity: "companies",
      imported: stats.companies,
      failed: failedImports.companies.length,
    },
    {
      entity: "contacts",
      imported: stats.contacts,
      failed: failedImports.contacts.length,
    },
    {
      entity: "notes",
      imported: stats.notes,
      failed: failedImports.notes.length,
    },
    {
      entity: "tasks",
      imported: stats.tasks,
      failed: failedImports.tasks.length,
    },
  ];
  return (
    <Table>
      <TableCaption className="sr-only">Import status</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]"></TableHead>
          <TableHead className="text-right">Imported</TableHead>
          <TableHead className="text-right">Failed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((record) => (
          <TableRow key={record.entity}>
            <TableCell className="font-medium">{record.entity}</TableCell>
            <TableCell className="text-right text-success">
              {record.imported}
            </TableCell>
            <TableCell className="text-right text-destructive">
              {record.failed}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
