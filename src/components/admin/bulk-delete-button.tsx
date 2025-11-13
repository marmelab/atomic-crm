import { Button } from "@/components/ui/button";
import { Trash } from "lucide-react";
import type { RaRecord, UseBulkDeleteControllerParams } from "ra-core";
import { Translate, useBulkDeleteController } from "ra-core";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const BulkDeleteButton = <
  RecordType extends RaRecord = any,
  MutationOptionsError = unknown,
>({
  icon = defaultIcon,
  label,
  className,
  ...props
}: BulkDeleteButtonProps<RecordType, MutationOptionsError>) => {
  const { handleDelete, isPending } = useBulkDeleteController(props);

  return (
    <Button
      variant="destructive"
      type="button"
      onClick={handleDelete}
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

export type BulkDeleteButtonProps<
  RecordType extends RaRecord = any,
  MutationOptionsError = unknown,
> = {
  label?: string;
  icon?: ReactNode;
} & React.ComponentPropsWithoutRef<"button"> &
  UseBulkDeleteControllerParams<RecordType, MutationOptionsError>;

const defaultIcon = <Trash />;
