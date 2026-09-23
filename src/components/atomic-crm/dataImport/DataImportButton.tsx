import { Upload } from "lucide-react";
import { useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";

import { useDataImportContext } from "./DataImportProvider";
import type { ImportableResourceName } from "./useImportableResources";

/**
 * Imports a CSV file into the CRM. Given a `resource`, it imports into that one
 * and the dialog opens without a resource dropdown; otherwise the dialog offers
 * every importable resource.
 */
export const DataImportButton = ({
  resource,
}: {
  resource?: ImportableResourceName;
}) => {
  const translate = useTranslate();
  const { resources, isImporting, openDialog } = useDataImportContext();
  const available = resource
    ? resources.filter(({ name }) => name === resource)
    : resources;

  // The resource may not be registered in this Admin, e.g. deals on mobile
  if (!available.length) return null;

  return (
    <Button
      variant="outline"
      onClick={() => openDialog(resource)}
      disabled={isImporting}
      title={isImporting ? translate("crm.data_import.in_progress") : undefined}
      className="flex items-center gap-2 cursor-pointer"
    >
      <Upload />{" "}
      {translate(resource ? "crm.data_import.button" : "crm.data_import.title")}
    </Button>
  );
};
