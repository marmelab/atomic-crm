import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import {
  Translate,
  useDeleteMany,
  useListContext,
  useNotify,
  useResourceContext,
  useTranslate,
  type MutationMode,
} from "ra-core";

export const BulkDeleteButton = ({
  mutationMode = "undoable",
}: {
  mutationMode?: MutationMode;
}) => {
  const resource = useResourceContext();
  const [deleteMany, { isPending }] = useDeleteMany();
  const { selectedIds, onUnselectItems } = useListContext();
  const notify = useNotify();
  const translate = useTranslate();
  const handleClick = (e: React.MouseEvent) => {
    stopPropagation(e);
    deleteMany(
      resource,
      { ids: selectedIds },
      {
        mutationMode,
        onSuccess: () => {
          onUnselectItems();
          notify(`resources.${resource}.notifications.deleted`, {
            messageArgs: {
              smart_count: selectedIds.length,
              _: translate("ra.notification.deleted", {
                smart_count: selectedIds.length,
                _: `${selectedIds.length} elements deleted`,
              }),
            },
            undoable: mutationMode === "undoable",
          });
        },
      }
    );
  };
  return (
    <Button
      variant="destructive"
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="h-9"
    >
      <Trash />
      <Translate i18nKey="ra.action.delete">Delete</Translate>
    </Button>
  );
};

// useful to prevent click bubbling in a datagrid with rowClick
const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
