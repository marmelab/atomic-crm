import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ImportFromJsonDialog } from "./ImportFromJsonDialog";
import { Upload } from "lucide-react";

export const ImportFromJsonButton = () => {
  const [modalOpen, setModalOpen] = useState(false);

  const handleOpenModal = () => {
    setModalOpen(true);
  };

  const handleCloseModal = (open: boolean) => {
    setModalOpen(open);
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={handleOpenModal}
        className="flex items-center gap-2 cursor-pointer"
      >
        <Upload /> Import JSON file
      </Button>
      <ImportFromJsonDialog open={modalOpen} onOpenChange={handleCloseModal} />
    </>
  );
};
