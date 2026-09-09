import { Search } from "lucide-react";
import { useTranslate } from "ra-core";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { GlobalSearchDialog } from "./GlobalSearchDialog";

/**
 * Opens the global search dialog. `variant="icon"` renders the compact
 * icon-only trigger used on mobile; the default renders a labelled trigger for
 * the desktop app bar.
 */
export const GlobalSearchButton = ({
  variant = "labelled",
}: {
  variant?: "labelled" | "icon";
}) => {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((previousOpen) => !previousOpen);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="ghost"
        size={variant === "icon" ? "icon" : "sm"}
        onClick={() => setOpen(true)}
        aria-label={translate("crm.search.title")}
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search />
        {variant === "labelled" ? (
          <span className="hidden lg:inline text-muted-foreground">
            {translate("crm.search.title")}
          </span>
        ) : null}
      </Button>
      <GlobalSearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
};
