import { Search } from "lucide-react";
import { useTranslate } from "ra-core";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { GlobalSearchDialog } from "./GlobalSearchDialog";

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
};

const SHORTCUT_LABEL =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent)
    ? "⌘K"
    : "Ctrl K";

/**
 * Opens the global search dialog. `variant="icon"` renders the compact
 * icon-only trigger used on mobile; the default renders an input-like trigger
 * for the desktop app bar.
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
      if (event.key !== "k" || !(event.metaKey || event.ctrlKey)) {
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      {variant === "icon" ? (
        <Button
          variant="ghost"
          size="icon"
          // same shape and icon size as its neighbour, MobileRefreshButton
          className="rounded-full"
          onClick={() => setOpen(true)}
          aria-label={translate("crm.search.title")}
        >
          <Search className="size-5" />
        </Button>
      ) : (
        // Looks like a search field, so its purpose reads at a glance; the
        // real input lives in the dialog it opens.
        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          aria-label={translate("crm.search.title")}
          aria-keyshortcuts="Control+K Meta+K"
          className="mr-2 w-40 justify-start bg-background px-3 font-normal text-muted-foreground lg:w-64"
        >
          <Search />
          <span className="flex-1 text-left">
            {translate("crm.search.title")}
          </span>
          <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-sans text-[10px] font-medium lg:inline">
            {SHORTCUT_LABEL}
          </kbd>
        </Button>
      )}
      <GlobalSearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
};
