import { useCreate } from "ra-core";
import type { Tag } from "@/components/atomic-crm/types";
import { TagDialog } from "@/components/atomic-crm/tags/TagDialog";

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
      title="Create a new tag"
      onClose={onClose}
      onSubmit={handleCreateTag}
    />
  );
}
