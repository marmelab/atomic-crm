import { useState } from "react";
import { Upload } from "lucide-react";
import { useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";

import { DataImportDialog } from "./DataImportDialog";
import type { ImportableResourceName } from "./useImportableResources";
import { useImportableResources } from "./useImportableResources";

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const importableResources = useImportableResources();
  const resources = resource
    ? importableResources.filter(({ name }) => name === resource)
    : importableResources;

  // The resource may not be registered in this Admin, e.g. deals on mobile
  if (!resources.length) return null;

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setDialogOpen(true)}
        className="flex items-center gap-2 cursor-pointer"
      >
        <Upload />{" "}
        {translate(
          resource ? "crm.data_import.button" : "crm.data_import.title",
        )}
      </Button>
      <DataImportDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        resources={resources}
      />
    </>
  );
};
