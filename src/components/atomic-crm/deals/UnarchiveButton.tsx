import type { ComponentProps, MouseEvent } from "react";
import { ArchiveRestore } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import {
  useDataProvider,
  useNotify,
  useRecordContext,
  useRedirect,
  useRefresh,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Deal } from "../types";

export const UnarchiveButton = ({
  record: _recordProp,
  className,
  onClick,
  ...props
}: { record?: Deal } & ComponentProps<typeof Button>) => {
  const dataProvider = useDataProvider();
  const redirect = useRedirect();
  const notify = useNotify();
  const refresh = useRefresh();
  const record = useRecordContext(props);

  const { mutate } = useMutation({
    mutationFn: () => dataProvider.unarchiveDeal(record),
    onSuccess: () => {
      redirect("list", "deals");
      notify("Deal unarchived", {
        type: "info",
        undoable: false,
      });
      refresh();
    },
    onError: () => {
      notify("Error: deal not unarchived", { type: "error" });
    },
  });

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    mutate();
    if (onClick) onClick(event);
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      variant="outline"
      className={cn("flex items-center gap-2 h-9", className)}
      type="button"
      {...props}
    >
      <ArchiveRestore className="w-4 h-4" />
      Send back to the board
    </Button>
  );
};
