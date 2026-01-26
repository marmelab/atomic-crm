import {
  useResourceContext,
  useCreatePath,
  useRecordFromLocation,
} from "ra-core";
import { useNavigate } from "react-router";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const MobileBackButton = (props: { resource?: string; to?: string }) => {
  const resource = useResourceContext(props);
  const recordFromLocation = useRecordFromLocation();
  const contact_id = recordFromLocation?.contact_id;
  const navigate = useNavigate();
  const createPath = useCreatePath();
  const { to } = props;
  const finalTo =
    to ??
    createPath({
      resource: contact_id ? "contacts" : resource,
      type: contact_id ? "show" : "list",
      id: contact_id,
    });

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="rounded-full"
      onClick={(e) => {
        e.preventDefault();
        navigate(finalTo);
      }}
    >
      <ChevronLeft className="size-6" />
      <span className="sr-only">Back to {contact_id ? "contact" : "list"}</span>
    </Button>
  );
};
