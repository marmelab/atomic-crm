import { Upload } from "lucide-react";
import { useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";

import { useContactImportContext } from "./ContactImportContext";

export const ContactImportButton = () => {
  const translate = useTranslate();
  const { openDialog } = useContactImportContext();

  return (
    <Button
      variant="outline"
      onClick={openDialog}
      className="flex items-center gap-2 cursor-pointer"
    >
      <Upload /> {translate("resources.contacts.import.button")}
    </Button>
  );
};
