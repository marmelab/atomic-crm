import type { ComponentProps, MouseEvent } from "react";
import { Archive } from "lucide-react";
import {
  useNotify,
  useRecordContext,
  useRedirect,
  useRefresh,
  useUpdate,
} from "ra-core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { Deal } from "../types";

export const ArchiveButton = ({
  record: _recordProp,
  className,
  onClick,
  ...props
}: { record?: Deal } & ComponentProps<typeof Button>) => {
  const redirect = useRedirect();
  const notify = useNotify();
  const refresh = useRefresh();
  const record = useRecordContext(props);
  const [update] = useUpdate(undefined, undefined, {
    onSuccess: () => {
      redirect("list", "deals");
      notify("Deal archived", { type: "info", undoable: false });
      refresh();
    },
    onError: () => {
      notify("Error: deal not archived", { type: "error" });
    },
  });
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    update("deals", {
      id: record?.id,
      data: { archived_at: new Date().toISOString() },
      previousData: record,
    });
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
      <Archive className="w-4 h-4" />
      Archive
    </Button>
  );
};
