import { Button } from "@/components/ui/button";
import { LoaderCircle, RotateCw } from "lucide-react";
import { useTranslate } from "ra-core";

import { useRefreshData } from "./useRefreshData";

/**
 * Refreshes the data of the current page. Rendered by <MobileHeader>, so every mobile
 * page has a discoverable, tappable way to refresh — the desktop <RefreshButton> is
 * hidden on small screens, and the <PullToRefresh> gesture is neither visible nor
 * available to everyone.
 */
export const MobileRefreshButton = () => {
  const translate = useTranslate();
  const { refresh, isRefreshing } = useRefreshData();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="rounded-full"
      aria-label={translate("ra.action.refresh")}
      disabled={isRefreshing}
      onClick={() => void refresh()}
    >
      {isRefreshing ? (
        <LoaderCircle className="size-5 animate-spin" />
      ) : (
        <RotateCw className="size-5" />
      )}
    </Button>
  );
};
