import { useResourceContext, useCreatePath } from "ra-core";
import { useNavigate } from "react-router";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const MobileBackButton = (props: { resource?: string; to?: string }) => {
  const resource = useResourceContext(props);
  const navigate = useNavigate();
  const createPath = useCreatePath();
  const { to } = props;
  const finalTo =
    to ??
    createPath({
      resource,
      type: "list",
    });

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="rounded-full size-5 pr-2"
      onClick={(e) => {
        e.preventDefault();
        navigate(finalTo);
      }}
    >
      <ChevronLeft className="size-6" />
      <span className="sr-only">Back{to ? "" : " to list"}</span>
    </Button>
  );
};
