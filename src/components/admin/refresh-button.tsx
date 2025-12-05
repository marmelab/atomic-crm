import { useRefresh, useLoading } from "ra-core";
import { Button } from "@/components/ui/button";
import { LoaderCircle, RotateCw } from "lucide-react";

/**
 * A button that refreshes the current view's data.
 *
 * When clicked, reloads data from the server. Shows a spinner animation during loading.
 * Included in the default top app bar. Hidden on small screens.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/refreshbutton/ RefreshButton documentation}
 */
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
