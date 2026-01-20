import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import type { RaRecord } from "ra-core";
import { useCreatePath, useRecordContext, useResourceContext } from "ra-core";
import { useNavigate } from "react-router";

export const EditButton = (props: { resource?: string; record?: RaRecord }) => {
  const resource = useResourceContext(props);
  const record = useRecordContext(props);
  const navigate = useNavigate();
  const createPath = useCreatePath();
  const to = createPath({
    resource,
    type: "edit",
    id: record?.id,
  });

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="rounded-full"
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
      }}
    >
      <Pencil className="size-6" />
      <span className="sr-only">Edit record</span>
    </Button>
  );
};
