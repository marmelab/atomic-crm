import { useRefresh, useLoading } from "ra-core";
import { Button } from "@/components/ui/button";
import { LoaderCircle, RotateCw } from "lucide-react";

export const RefreshButton = () => {
  const refresh = useRefresh();
  const loading = useLoading();

  const handleRefresh = () => {
    refresh();
  };

  return (
    <Button
      onClick={handleRefresh}
      variant="ghost"
      size="icon"
      className="hidden sm:inline-flex"
    >
      {loading ? <LoaderCircle className="animate-spin" /> : <RotateCw />}
    </Button>
  );
};
