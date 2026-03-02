import { useCreate, useTranslate } from "ra-core";

import type { Tag } from "../types";
import { TagDialog } from "./TagDialog";

type TagCreateModalProps = {
  open: boolean;
  onClose(): void;
  onSuccess?(tag: Tag): Promise<void>;
};

export function TagCreateModal({
  open,
  onClose,
  onSuccess,
}: TagCreateModalProps) {
  const [create] = useCreate<Tag>();
  const translate = useTranslate();

  const handleCreateTag = async (data: Pick<Tag, "name" | "color">) => {
    await create(
      "tags",
      { data },
      {
        onSuccess: async (tag) => {
          await onSuccess?.(tag);
        },
      },
    );
  };

  return (
    <TagDialog
      open={open}
      title={translate("crm.tags.dialog.create_title", {
        _: "Create a new tag",
      })}
      onClose={onClose}
      onSubmit={handleCreateTag}
    />
  );
}
