import { useEffect } from "react";
import { useTranslate } from "ra-core";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import type { ImportState } from "../misc/usePapaParse";

const TOAST_ID = "data-import-progress";

export const DataImportProgressToast = ({
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
              {translate("crm.data_import.in_progress")}
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={onStop}
              className="text-destructive h-auto p-0 text-xs"
            >
              {translate("crm.data_import.stop")}
            </Button>
          </div>
          {hasProgress && (
            <>
              <Progress
                value={
                  rowCount ? ((importCount + errorCount) / rowCount) * 100 : 0
                }
                aria-label={translate("crm.data_import.in_progress")}
              />
              <p className="text-muted-foreground text-xs">
                {translate("crm.data_import.progress", {
                  importCount,
                  rowCount,
                  errorCount,
                })}
                {remainingTime !== null && (
                  <>
                    {" "}
                    {translate("crm.data_import.remaining_time")}{" "}
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

const millisecondsToTime = (ms: number) => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (60 * 1000)) % 60);

  return `${minutes}m ${seconds}s`;
};
