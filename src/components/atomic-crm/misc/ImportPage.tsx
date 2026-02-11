import { AlertCircleIcon } from "lucide-react";
import { Form, required } from "ra-core";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { FileField, FileInput } from "@/components/admin";
import {
  type ImportFromJsonErrorState,
  type ImportFromJsonFailures,
  type ImportFromJsonFunction,
  type ImportFromJsonState,
  useImportFromJson,
} from "./useImportFromJson";
import sampleFile from "./import-sample.json?url";

export const ImportPage = () => {
  const [importState, importFile, reset] = useImportFromJson();

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle>Import Data</CardTitle>
        </CardHeader>
        <CardContent>
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
            <ImportFromJsonSuccess importState={importState} reset={reset} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

ImportPage.path = "/import";

const ImportFromJsonIdle = ({
  importFile,
}: {
  importFile: ImportFromJsonFunction;
}) => (
  <>
    <div className="mb-4">
      <p className="text-sm">
        You can import sales, companies, contacts, companies, notes, and tasks.
      </p>
      <p className="text-sm">
        Data must be in a JSON file matching the following sample:{" "}
        <a
          className="underline"
          download="import-sample.json"
          href={sampleFile}
        >
          sample.json
        </a>
      </p>
    </div>
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
    <Alert variant="destructive" className="mb-4">
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
    <div className="flex justify-end mt-4">
      <Button type="submit">Import</Button>
    </div>
  </Form>
);

const ImportFromJsonStatus = ({
  importState,
}: {
  importState: ImportFromJsonState;
}) => (
  <>
    <Spinner />
    <p className="my-4 text-sm text-center text-muted-foreground">
      Import in progress, please don't navigate away from this page.
    </p>
    <ImportStats importState={importState} />
  </>
);

const ImportFromJsonSuccess = ({
  importState,
  reset,
}: {
  importState: ImportFromJsonState;
  reset: () => void;
}) => (
  <>
    <p className="mb-4 text-sm">
      Import complete.{" "}
      {hasFailedImports(importState.failedImports) ? (
        <>
          <span className="text-destructive">
            Some records were not imported.
          </span>
          <DownloadErrorFileButton failedImports={importState.failedImports} />
        </>
      ) : (
        <span>All records were imported successfully.</span>
      )}
    </p>
    <ImportStats importState={importState} />
    <div className="flex justify-end mt-4">
      <Button variant="outline" onClick={reset}>
        Import another file
      </Button>
    </div>
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
      className="font-semibold"
      onClick={async (event) => {
        const json = JSON.stringify(failedImports);
        const blob = new Blob([json], { type: "octet/stream" });
        const url = window.URL.createObjectURL(blob);
        event.currentTarget.href = url;
      }}
      download="atomic-crm-import-report.json"
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
          <TableHead className="w-25"></TableHead>
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
