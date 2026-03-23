import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Tag } from "../types";
import { TagForm } from "./TagForm";

type TagDialogProps = {
  open: boolean;
  tag?: Pick<Tag, "name" | "color">;
  title: string;
  onSubmit(tag: Pick<Tag, "name" | "color">): Promise<void>;
  onClose(): void;
};

export function TagDialog({
  open,
  tag,
  title,
  onClose,
  onSubmit,
}: TagDialogProps) {
  const handleClose = (isOpen = false) => {
    if (!isOpen) {
      onClose();
    }
  };

  const handleSubmit = async (data: Pick<Tag, "name" | "color">) => {
    await onSubmit(data);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <TagForm open={open} tag={tag} onSubmit={handleSubmit} />
      </DialogContent>
    </Dialog>
  );
}
