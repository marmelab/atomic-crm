import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNotify, useRefresh } from "ra-core";

import { usePapaParse } from "../misc/usePapaParse";
import { ContactImportContext } from "./ContactImportContext";
import { ContactImportDialog } from "./ContactImportDialog";
import { ContactImportProgressToast } from "./ContactImportProgressToast";
import type { ContactImportSchema } from "./useContactImport";
import { useContactImport } from "./useContactImport";

export const ContactImportProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const processBatch = useContactImport();
  const { importer, parseCsv, reset } = usePapaParse<ContactImportSchema>({
    batchSize: 10,
    processBatch,
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (importer.state === "complete") {
      refresh();
      notify("resources.contacts.import.complete", {
        type: "success",
        messageArgs: {
          importCount: importer.importCount,
          errorCount: importer.errorCount,
        },
      });
    }
    if (importer.state === "error") {
      notify("resources.contacts.import.error", { type: "error" });
    }
  }, [importer, notify, refresh]);

  const isRunning =
    importer.state === "parsing" || importer.state === "running";

  useEffect(() => {
    if (!isRunning) return;

    const confirmLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", confirmLeave);
    return () => window.removeEventListener("beforeunload", confirmLeave);
  }, [isRunning]);

  const openDialog = useCallback(() => {
    if (importer.state === "complete" || importer.state === "error") {
      reset();
    }
    setIsDialogOpen(true);
  }, [importer.state, reset]);

  const closeDialog = useCallback(() => setIsDialogOpen(false), []);

  const value = useMemo(
    () => ({
      importer,
      isDialogOpen,
      openDialog,
      closeDialog,
      startImport: parseCsv,
      reset,
    }),
    [importer, isDialogOpen, openDialog, closeDialog, parseCsv, reset],
  );

  return (
    <ContactImportContext.Provider value={value}>
      {children}
      <ContactImportDialog />
      <ContactImportProgressToast />
    </ContactImportContext.Provider>
  );
};
