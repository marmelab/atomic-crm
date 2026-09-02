import { createContext, useContext } from "react";

import type { ImportState } from "../misc/usePapaParse";

export type ContactImportContextValue = {
  importer: ImportState;
  isDialogOpen: boolean;
  openDialog(): void;
  closeDialog(): void;
  startImport(file: File): void;
  reset(): void;
};

export const ContactImportContext = createContext<
  ContactImportContextValue | undefined
>(undefined);

export const useContactImportContext = () => {
  const context = useContext(ContactImportContext);
  if (!context) {
    throw new Error(
      "useContactImportContext must be used inside a <ContactImportProvider>",
    );
  }
  return context;
};
