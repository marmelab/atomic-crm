import type { LayoutComponent } from "ra-core";

import { ContactImportProvider } from "./ContactImportProvider";

export const withContactImport =
  (AppLayout: LayoutComponent): LayoutComponent =>
  ({ children }) => (
    <AppLayout>
      <ContactImportProvider>{children}</ContactImportProvider>
    </AppLayout>
  );
