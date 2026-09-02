import { useState } from "react";
import type { MouseEvent } from "react";
import { Loader2 } from "lucide-react";
import { Form, useTranslate } from "ra-core";
import { Link } from "react-router";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormToolbar } from "@/components/admin/simple-form";
import { FileInput } from "@/components/admin/file-input";
import { FileField } from "@/components/admin/file-field";

import { useContactImportContext } from "./ContactImportContext";
import * as sampleCsv from "./contacts_export.csv?raw";

const SAMPLE_URL = `data:text/csv;name=crm_contacts_sample.csv;charset=utf-8,${encodeURIComponent(
  sampleCsv.default,
)}`;

export function ContactImportDialog() {
  const translate = useTranslate();
  const { importer, isDialogOpen, closeDialog, startImport, reset } =
    useContactImportContext();

  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (file: File | null) => {
    setFile(file);
  };

  const handleStartImport = () => {
    if (!file) return;
    startImport(file);
  };

  const handleClose = () => {
    setFile(null);
    closeDialog();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) handleClose();
  };

  const handleReset = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setFile(null);
    reset();
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <Form className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {translate("resources.contacts.import.title")}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col space-y-2">
            {importer.state === "running" && (
              <div className="flex flex-col gap-2">
                <Alert>
                  <AlertDescription className="flex flex-row gap-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {translate("resources.contacts.import.running")}
                  </AlertDescription>
                </Alert>

                <div className="text-sm">
                  {translate("resources.contacts.import.progress", {
                    importCount: importer.importCount,
                    rowCount: importer.rowCount,
                    errorCount: importer.errorCount,
                  })}
                  {importer.remainingTime !== null && (
                    <>
                      {" "}
                      {translate(
                        "resources.contacts.import.remaining_time",
                      )}{" "}
                      <strong>
                        {millisecondsToTime(importer.remainingTime)}
                      </strong>
                      .{" "}
                      <button
                        onClick={handleReset}
                        className="text-red-600 underline hover:text-red-800"
                      >
                        {translate("resources.contacts.import.stop")}
                      </button>
                    </>
                  )}
                </div>

                <p className="text-muted-foreground text-sm">
                  {translate("resources.contacts.import.background_hint")}
                </p>
              </div>
            )}

            {importer.state === "error" && (
              <Alert variant="destructive">
                <AlertDescription>
                  {translate("resources.contacts.import.error")}
                </AlertDescription>
              </Alert>
            )}

            {importer.state === "complete" && (
              <Alert>
                <AlertDescription>
                  {translate("resources.contacts.import.complete", {
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
                    {translate("resources.contacts.import.sample_hint")}
                    <Button asChild variant="outline" size="sm">
                      <Link
                        to={SAMPLE_URL}
                        download={"crm_contacts_sample.csv"}
                      >
                        {translate("resources.contacts.import.sample_download")}
                      </Link>
                    </Button>{" "}
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
              </>
            )}
          </div>
        </Form>

        <div className="flex justify-start pt-6">
          <FormToolbar>
            {importer.state === "idle" ? (
              <Button onClick={handleStartImport} disabled={!file}>
                {translate("resources.contacts.import.button")}
              </Button>
            ) : (
              <Button variant="outline" onClick={handleClose}>
                {translate("ra.action.close")}
              </Button>
            )}
          </FormToolbar>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function millisecondsToTime(ms: number) {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (60 * 1000)) % 60);

  return `${minutes}m ${seconds}s`;
}
