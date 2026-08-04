import { useEffect } from "react";
import { useTranslate } from "ra-core";
import { toast } from "sonner";

import { Progress } from "@/components/ui/progress";
import { useContactImportContext } from "./ContactImportContext";

const TOAST_ID = "contact-import-progress";

export const ContactImportProgressToast = () => {
  const translate = useTranslate();
  const { importer, isDialogOpen } = useContactImportContext();

  const isRunning =
    importer.state === "parsing" || importer.state === "running";
  const rowCount = importer.state === "running" ? importer.rowCount : 0;
  const importCount = importer.state === "running" ? importer.importCount : 0;
  const errorCount = importer.state === "running" ? importer.errorCount : 0;

  useEffect(() => {
    if (!isRunning || isDialogOpen) {
      toast.dismiss(TOAST_ID);
      return;
    }

    toast.custom(
      () => (
        <div className="bg-popover text-popover-foreground flex w-full flex-col gap-2 rounded-md border p-4 shadow-lg">
          <p className="text-sm font-medium">
            {translate("resources.contacts.import.in_progress")}
          </p>
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
          </p>
        </div>
      ),
      { id: TOAST_ID, duration: Infinity, position: "bottom-right" },
    );
  }, [isRunning, isDialogOpen, importCount, rowCount, errorCount, translate]);

  useEffect(
    () => () => {
      toast.dismiss(TOAST_ID);
    },
    [],
  );

  return null;
};
