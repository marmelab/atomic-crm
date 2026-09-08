import { Upload } from "lucide-react";
import { useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";

import { useContactImportContext } from "./ContactImportProvider";

export const ContactImportButton = () => {
  const translate = useTranslate();
  const { isImporting, openDialog } = useContactImportContext();

  return (
    <Button
      variant="outline"
      onClick={openDialog}
      disabled={isImporting}
      title={
        isImporting
          ? translate("resources.contacts.import.in_progress")
          : undefined
      }
      className="flex items-center gap-2 cursor-pointer"
    >
      <Upload /> {translate("resources.contacts.import.button")}
    </Button>
  );
};
