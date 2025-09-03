import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import {
  Translate,
  useDeleteMany,
  useListContext,
  useNotify,
  useRefresh,
  useResourceContext,
  useTranslate,
  type MutationMode,
  type RaRecord,
  type UseDeleteManyOptions,
} from "ra-core";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export interface BulkDeleteButtonProps<
  RecordType extends RaRecord = any,
  MutationOptionsError = unknown,
> extends React.HTMLAttributes<HTMLButtonElement> {
  mutationMode?: MutationMode;
  label?: string;
  resource?: string;
  className?: string;
  icon?: ReactNode;
  mutationOptions?: UseDeleteManyOptions<RecordType, MutationOptionsError> & {
    meta?: any;
  };
}

export const BulkDeleteButton = <
  RecordType extends RaRecord = any,
  MutationOptionsError = unknown,
>(
  props: BulkDeleteButtonProps<RecordType, MutationOptionsError>,
) => {
  const {
    mutationMode = "undoable",
    icon = defaultIcon,
    label,
    className,
    mutationOptions = {},
  } = props;
  const { meta: mutationMeta, ...otherMutationOptions } = mutationOptions;
  const resource = useResourceContext(props);
  const [deleteMany, { isPending }] = useDeleteMany<
    RecordType,
    MutationOptionsError
  >();
  const { selectedIds, onUnselectItems } = useListContext();
  const notify = useNotify();
  const refresh = useRefresh();
  const translate = useTranslate();
  const handleClick = (e: React.MouseEvent) => {
    stopPropagation(e);
    deleteMany(
      resource,
      { ids: selectedIds, meta: mutationMeta },
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
        onError: (error: MutationOptionsError) => {
          const errorMessage =
            typeof error === "string" ? error : (error as any)?.message;
          notify(errorMessage || "ra.notification.http_error", {
            type: "error",
            messageArgs: { _: errorMessage },
          });
          refresh();
        },
        ...otherMutationOptions,
      },
    );
  };
  return (
    <Button
      variant="destructive"
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={cn("h-9", className)}
    >
      {icon}
      <Translate i18nKey={label ?? "ra.action.delete"}>
        {label ?? "Delete"}
      </Translate>
    </Button>
  );
};

const defaultIcon = <Trash />;

// useful to prevent click bubbling in a datagrid with rowClick
const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
