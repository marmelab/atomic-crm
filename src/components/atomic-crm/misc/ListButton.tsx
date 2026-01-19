import { useResourceContext, useCreatePath } from "ra-core";
import { useNavigate } from "react-router";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ListButton = (props: { resource?: string }) => {
  const resource = useResourceContext(props);
  const navigate = useNavigate();
  const createPath = useCreatePath();
  const to = createPath({ resource, type: "list" });

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
      <ChevronLeft className="size-6" />
      <span className="sr-only">Back to list</span>
    </Button>
  );
};
