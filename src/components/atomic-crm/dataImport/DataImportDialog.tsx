import { useEffect, useState } from "react";
import {
  Form,
  useGetResourceLabel,
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

import type { ImportableResource } from "./types";
import type { ImportableResourceName } from "./useImportableResources";

type DataImportDialogProps = {
  open: boolean;
  /** Resources offered in the dropdown. A single one hides the dropdown. */
  resources: ImportableResource[];
  resource: ImportableResource;
  onResourceChange(name: ImportableResourceName): void;
  onStart(file: File): void;
  onClose(): void;
};

export function DataImportDialog({
  open,
  resources,
  resource,
  onResourceChange,
  onStart,
  onClose,
}: DataImportDialogProps) {
  const translate = useTranslate();
  const getResourceLabel = useGetResourceLabel();
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    setFile(null);
  }, [resource.name, open]);

  // Importing a single resource names the dialog after it, falling back to the
  // generic heading for a resource that has no title of its own.
  const title = useResourceTranslation({
    resourceI18nKey:
      resources.length === 1
        ? `resources.${resource.name}.import.title`
        : undefined,
    baseI18nKey: "crm.data_import.title",
  });

  const sampleUrl = `data:text/csv;name=${sampleFileName(resource.name)};charset=utf-8,${encodeURIComponent(resource.sampleCsv)}`;

  const handleResourceChange = (name: string) => {
    const next = resources.find((candidate) => candidate.name === name);
    if (!next) return;
    onResourceChange(next.name);
  };

  const handleStart = () => {
    if (!file) return;
    onStart(file);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
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

            <Alert>
              <AlertDescription className="flex flex-col gap-4">
                {translate("crm.data_import.sample_hint")}
                <Button asChild variant="outline" size="sm">
                  <Link to={sampleUrl} download={sampleFileName(resource.name)}>
                    {translate("crm.data_import.sample_download")}
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>

            <FileInput
              source="csv"
              label="crm.data_import.csv_file"
              accept={{ "text/csv": [".csv"] }}
              onChange={setFile}
            >
              <FileField source="src" title="title" target="_blank" />
            </FileInput>
          </div>
        </Form>

        <div className="flex justify-start">
          <FormToolbar>
            <Button onClick={handleStart} disabled={!file}>
              {translate("crm.data_import.start")}
            </Button>
          </FormToolbar>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const sampleFileName = (resourceName: string) =>
  `crm_${resourceName}_sample.csv`;
