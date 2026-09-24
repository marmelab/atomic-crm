/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNotify, useRefresh } from "ra-core";

import { usePapaParse } from "../misc/usePapaParse";
import { DataImportDialog } from "./DataImportDialog";
import { DataImportProgressToast } from "./DataImportProgressToast";
import type { ImportableResource, ImportRow } from "./types";
import type { ImportableResourceName } from "./useImportableResources";
import { useImportableResources } from "./useImportableResources";

type DataImportContextValue = {
  resources: ImportableResource[];
  isImporting: boolean;
  openDialog(resource?: ImportableResourceName): void;
};

const DataImportContext = createContext<DataImportContextValue | undefined>(
  undefined,
);

export const useDataImportContext = () => {
  const context = useContext(DataImportContext);
  if (!context) {
    throw new Error(
      "useDataImportContext must be used inside a <DataImportProvider>",
    );
  }
  return context;
};

export const DataImportProvider = ({ children }: { children: ReactNode }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const resources = useImportableResources();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pinnedName, setPinnedName] = useState<ImportableResourceName | null>(
    null,
  );
  const [resourceName, setResourceName] =
    useState<ImportableResourceName | null>(null);

  // The resource is read from `resources` on every render, keeping only the
  // selected name in state: `useConfigurationLoader` fills the configuration
  // asynchronously, so a resource object captured at mount would keep its
  // `processBatch` pinned to `defaultConfiguration` — importing a deal into a
  // stage that does not exist in a customized pipeline, and with no `sales_id`.
  const resource =
    resources.find(({ name }) => name === resourceName) ?? resources[0];

  const { importer, parseCsv, reset } = usePapaParse<ImportRow>({
    batchSize: 10,
    textColumns: resource?.textColumns,
    processBatch: resource?.processBatch ?? rejectImport,
  });

  const isImporting =
    importer.state === "parsing" || importer.state === "running";

  useEffect(() => {
    if (importer.state === "complete") {
      refresh();
      notify("crm.data_import.complete", {
        type: "success",
        messageArgs: {
          importCount: importer.importCount,
          errorCount: importer.errorCount,
        },
      });
    }
    if (importer.state === "error") {
      notify("crm.data_import.error", { type: "error" });
    }
  }, [importer, notify, refresh]);

  useEffect(() => {
    if (!isImporting) return;

    const confirmLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", confirmLeave);
    return () => window.removeEventListener("beforeunload", confirmLeave);
  }, [isImporting]);

  const openDialog = useCallback(
    (pinned?: ImportableResourceName) => {
      if (importer.state === "complete" || importer.state === "error") {
        reset();
      }
      setPinnedName(pinned ?? null);
      setResourceName(pinned ?? resources[0]?.name ?? null);
      setIsDialogOpen(true);
    },
    [importer.state, reset, resources],
  );

  // reset() goes back to `idle`, so the `complete` effect never fires.
  const stopImport = useCallback(() => {
    const stopped = importer.state === "running" ? importer : null;
    reset();
    if (!stopped) return;
    refresh();
    notify("crm.data_import.stopped", {
      type: "info",
      messageArgs: {
        importCount: stopped.importCount,
        errorCount: stopped.errorCount,
      },
    });
  }, [importer, notify, refresh, reset]);

  const startImport = (file: File) => {
    parseCsv(file);
    setIsDialogOpen(false);
  };

  const value = useMemo(
    () => ({ resources, isImporting, openDialog }),
    [resources, isImporting, openDialog],
  );

  return (
    <DataImportContext.Provider value={value}>
      {children}
      {resource && (
        <DataImportDialog
          open={isDialogOpen}
          resources={
            pinnedName
              ? resources.filter(({ name }) => name === pinnedName)
              : resources
          }
          resource={resource}
          onResourceChange={setResourceName}
          onStart={startImport}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
      <DataImportProgressToast importer={importer} onStop={stopImport} />
    </DataImportContext.Provider>
  );
};

const rejectImport = () =>
  Promise.reject(new Error("No importable resource is registered"));
