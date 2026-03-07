import { AlertCircleIcon } from "lucide-react";
import { Form, required, useTranslate } from "ra-core";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
  const translate = useTranslate();
  const [importState, importFile, reset] = useImportFromJson();

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle>
            {translate("crm.import.title", { _: "Import Data" })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {importState.status === "idle" ? (
            <ImportFromJsonIdle importFile={importFile} translate={translate} />
          ) : importState.status === "error" ? (
            <ImportFromJsonError
              importState={importState}
              importFile={importFile}
              translate={translate}
            />
          ) : importState.status === "importing" ? (
            <ImportFromJsonStatus
              importState={importState}
              translate={translate}
            />
          ) : (
            <ImportFromJsonSuccess
              importState={importState}
              reset={reset}
              translate={translate}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

ImportPage.path = "/import";

const ImportFromJsonIdle = ({
  importFile,
  translate,
}: {
  importFile: ImportFromJsonFunction;
  translate: (key: string, options?: any) => string;
}) => (
  <>
    <div className="mb-4">
      <p className="text-sm">
        {translate("crm.import.idle.description_1", {
          _: "You can import sales, companies, contacts, companies, notes, and tasks.",
        })}
      </p>
      <p className="text-sm">
        {translate("crm.import.idle.description_2", {
          _: "Data must be in a JSON file matching the following sample:",
        })}{" "}
        <a
          className="underline"
          download="import-sample.json"
          href={sampleFile}
        >
          sample.json
        </a>
      </p>
    </div>
    <ImportFromJsonForm importFile={importFile} translate={translate} />
  </>
);

const ImportFromJsonError = ({
  importState,
  importFile,
  translate,
}: {
  importFile: ImportFromJsonFunction;
  importState: ImportFromJsonErrorState;
  translate: (key: string, options?: any) => string;
}) => (
  <>
    <Alert variant="destructive" className="mb-4">
      <AlertCircleIcon />
      <AlertTitle>
        {translate("crm.import.error.unable", {
          _: "Unable to import this file.",
        })}
      </AlertTitle>
      <AlertDescription>
        <p>{importState.error.message}</p>
      </AlertDescription>
    </Alert>
    <ImportFromJsonForm importFile={importFile} translate={translate} />
  </>
);

const ImportFromJsonForm = ({
  importFile,
  translate,
}: {
  importFile: ImportFromJsonFunction;
  translate: (key: string, options?: any) => string;
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
      <Button type="submit">
        {translate("crm.import.action.import", { _: "Import" })}
      </Button>
    </div>
  </Form>
);

const ImportFromJsonStatus = ({
  importState,
  translate,
}: {
  importState: ImportFromJsonState;
  translate: (key: string, options?: any) => string;
}) => (
  <>
    <Spinner />
    <p className="my-4 text-sm text-center text-muted-foreground">
      {translate("crm.import.status.in_progress", {
        _: "Import in progress, please don't navigate away from this page.",
      })}
    </p>
    <ImportStats importState={importState} translate={translate} />
  </>
);

const ImportFromJsonSuccess = ({
  importState,
  reset,
  translate,
}: {
  importState: ImportFromJsonState;
  reset: () => void;
  translate: (key: string, options?: any) => string;
}) => (
  <>
    <p className="mb-4 text-sm">
      {translate("crm.import.status.complete", { _: "Import complete." })}{" "}
      {hasFailedImports(importState.failedImports) ? (
        <>
          <span className="text-destructive">
            {translate("crm.import.status.some_failed", {
              _: "Some records were not imported.",
            })}{" "}
          </span>
          <DownloadErrorFileButton
            failedImports={importState.failedImports}
            translate={translate}
          />
        </>
      ) : (
        <span>
          {translate("crm.import.status.all_success", {
            _: "All records were imported successfully.",
          })}
        </span>
      )}
    </p>
    <ImportStats importState={importState} translate={translate} />
    <div className="flex justify-end mt-4">
      <Button variant="outline" onClick={reset}>
        {translate("crm.import.action.import_another", {
          _: "Import another file",
        })}
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
  translate,
}: {
  failedImports: ImportFromJsonFailures;
  translate: (key: string, options?: any) => string;
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
      {translate("crm.import.action.download_error_report", {
        _: "Download the error report",
      })}
    </a>
  );
};

const ImportStats = ({
  importState: { stats, failedImports },
  translate,
}: {
  importState: ImportFromJsonState;
  translate: (key: string, options?: any) => string;
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
      <TableCaption className="sr-only">
        {translate("crm.import.status.table_caption", { _: "Import status" })}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-25"></TableHead>
          <TableHead className="text-right">
            {translate("crm.import.status.imported", { _: "Imported" })}
          </TableHead>
          <TableHead className="text-right">
            {translate("crm.import.status.failed", { _: "Failed" })}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((record) => (
          <TableRow key={record.entity}>
            <TableCell className="font-medium">{record.entity}</TableCell>
            <TableCell className="text-right text-success">
              {record.imported}
            </TableCell>
            <TableCell
              className={cn(
                "text-right",
                record.failed > 0 && "text-destructive",
              )}
            >
              {record.failed}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
