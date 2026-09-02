import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { Loader2 } from "lucide-react";
import {
  Form,
  useGetResourceLabel,
  useRefresh,
  useResourceTranslation,
  useTranslate,
} from "ra-core";
import { Link } from "react-router";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormToolbar } from "@/components/admin/simple-form";
import { FileInput } from "@/components/admin/file-input";
import { FileField } from "@/components/admin/file-field";

import { usePapaParse } from "../misc/usePapaParse";
import type { ImportableResource, ImportRow } from "./types";

type DataImportDialogProps = {
  open: boolean;
  onClose(): void;
  /** Resources offered in the dropdown. A single one hides the dropdown. */
  resources: ImportableResource[];
};

export function DataImportDialog({
  open,
  onClose,
  resources,
}: DataImportDialogProps) {
  const translate = useTranslate();
  const getResourceLabel = useGetResourceLabel();
  const refresh = useRefresh();
  const [resourceName, setResourceName] = useState(resources[0].name);
  const [file, setFile] = useState<File | null>(null);

  // The resource is read from `resources` on every render, keeping only the
  // selected name in state: `useConfigurationLoader` fills the configuration
  // asynchronously, so a resource object captured at mount would keep its
  // `processBatch` pinned to `defaultConfiguration` — importing a deal into a
  // stage that does not exist in a customized pipeline, and with no `sales_id`.
  const resource =
    resources.find(({ name }) => name === resourceName) ?? resources[0];

  // Importing a single resource names the dialog after it, falling back to the
  // generic heading for a resource that has no title of its own.
  const title = useResourceTranslation({
    resourceI18nKey:
      resources.length === 1
        ? `resources.${resource.name}.import.title`
        : undefined,
    baseI18nKey: "crm.data_import.title",
  });
  const { importer, parseCsv, reset } = usePapaParse<ImportRow>({
    batchSize: 10,
    textColumns: resource.textColumns,
    processBatch: resource.processBatch,
  });

  const sampleUrl = `data:text/csv;name=${sampleFileName(resource.name)};charset=utf-8,${encodeURIComponent(resource.sampleCsv)}`;

  useEffect(() => {
    if (importer.state === "complete") {
      refresh();
    }
  }, [importer.state, refresh]);

  const handleResourceChange = (name: string) => {
    const next = resources.find((candidate) => candidate.name === name);
    if (!next) return;
    setFile(null);
    setResourceName(next.name);
  };

  const handleFileChange = (file: File | null) => {
    setFile(file);
  };

  const startImport = () => {
    if (!file) return;
    parseCsv(file);
  };

  const handleClose = () => {
    reset();
    setFile(null);
    onClose();
  };

  const handleReset = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] gap-6 p-6 sm:max-w-2xl sm:p-8">
        {/* Remount the form on resource change so no file survives the switch */}
        <Form key={resource.name} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col space-y-6">
            {resources.length > 1 && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="data-import-resource">
                  {translate("crm.data_import.resource")}
                </Label>
                <Select
                  value={resource.name}
                  onValueChange={handleResourceChange}
                  disabled={importer.state !== "idle"}
                >
                  <SelectTrigger id="data-import-resource" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {resources.map(({ name }) => (
                      <SelectItem key={name} value={name}>
                        {getResourceLabel(name, 2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {importer.state === "running" && (
              <div className="flex flex-col gap-2">
                <Alert>
                  <AlertDescription className="flex flex-row gap-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {translate("crm.data_import.running")}
                  </AlertDescription>
                </Alert>

                <div className="text-sm">
                  {translate("crm.data_import.progress", {
                    importCount: importer.importCount,
                    rowCount: importer.rowCount,
                    errorCount: importer.errorCount,
                  })}
                  {importer.remainingTime !== null && (
                    <>
                      {" "}
                      {translate("crm.data_import.remaining_time")}{" "}
                      <strong>
                        {millisecondsToTime(importer.remainingTime)}
                      </strong>
                      .{" "}
                      <button
                        onClick={handleReset}
                        className="text-red-600 underline hover:text-red-800"
                      >
                        {translate("crm.data_import.stop")}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {importer.state === "error" && (
              <Alert variant="destructive">
                <AlertDescription>
                  {translate("crm.data_import.error")}
                </AlertDescription>
              </Alert>
            )}

            {importer.state === "complete" && (
              <Alert>
                <AlertDescription>
                  {translate("crm.data_import.complete", {
                    importCount: importer.importCount,
                    errorCount: importer.errorCount,
                  })}
                </AlertDescription>
              </Alert>
            )}

            {importer.state === "idle" && (
              <>
                <Alert>
                  <AlertDescription className="flex flex-col gap-4">
                    {translate("crm.data_import.sample_hint")}
                    <Button asChild variant="outline" size="sm">
                      <Link
                        to={sampleUrl}
                        download={sampleFileName(resource.name)}
                      >
                        {translate("crm.data_import.sample_download")}
                      </Link>
                    </Button>
                  </AlertDescription>
                </Alert>

                <FileInput
                  source="csv"
                  label="crm.data_import.csv_file"
                  accept={{ "text/csv": [".csv"] }}
                  onChange={handleFileChange}
                >
                  <FileField source="src" title="title" target="_blank" />
                </FileInput>
              </>
            )}
          </div>
        </Form>

        <div className="flex justify-start">
          <FormToolbar>
            {importer.state === "idle" ? (
              <Button onClick={startImport} disabled={!file}>
                {translate("crm.data_import.start")}
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={importer.state === "running"}
              >
                {translate("ra.action.close")}
              </Button>
            )}
          </FormToolbar>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const sampleFileName = (resourceName: string) =>
  `crm_${resourceName}_sample.csv`;

const millisecondsToTime = (ms: number) => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (60 * 1000)) % 60);

  return `${minutes}m ${seconds}s`;
};
