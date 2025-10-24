import { useUpdate } from "ra-core";
import type { Tag } from "@/components/atomic-crm/types";
import { TagDialog } from "@/components/atomic-crm/tags/TagDialog";

type TagEditModalProps = {
  tag: Tag;
  open: boolean;
  onClose(): void;
  onSuccess?(tag: Tag): Promise<void>;
};

export function TagEditModal({
  tag,
  open,
  onClose,
  onSuccess,
}: TagEditModalProps) {
  const [update] = useUpdate<Tag>();

  const handleEditTag = async (data: Pick<Tag, "name" | "color">) => {
    await update(
      "tags",
      { id: tag.id, data, previousData: tag },
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
      title="Edit tag"
      onClose={onClose}
      onSubmit={handleEditTag}
      tag={tag}
    />
  );
}
