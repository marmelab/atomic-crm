import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Search, XIcon } from "lucide-react";
import { useDataProvider, useDebouncedEvent, useTranslate } from "ra-core";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerVirtualKeyboardProvider,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

import type { CrmDataProvider } from "../providers/types";
import type { SearchResourceName, SearchResult } from "../types";
import {
  DESKTOP_SEARCH_RESOURCES,
  MOBILE_SEARCH_RESOURCES,
  SEARCH_RESOURCES,
  getSearchResultUrl,
  getSearchTerms,
  getSnippet,
  highlight,
} from "./searchModel";
import { RecentContactsGroup } from "./RecentContactsGroup";

// Whether the keyboard shortcut fired while the user is typing in a field, in
// which case it must not open the dialog. contenteditable covers rich text
// editors (Tiptap, Lexical...), which have no such field today but commonly
// bind Ctrl/Cmd+K to "insert link".
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
  const inputRef = useRef<HTMLInputElement>(null);

  // iOS only opens the virtual keyboard for a focus made during the tap
  // itself, while Base UI focuses the dialog a frame later: render it now and
  // focus its input before the click handler returns. Without preventScroll,
  // iOS scrolls the mobile drawer, still sliding in from below the screen, to
  // bring the input into view, pushing it off the top.
  const openDialog = () => {
    flushSync(() => setOpen(true));
    inputRef.current?.focus({ preventScroll: true });
  };

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
          className="rounded-full"
          onClick={openDialog}
          aria-label={translate("crm.search.title")}
        >
          <Search className="size-5" />
        </Button>
      ) : (
        // Looks like a search field, so its purpose reads at a glance; the
        // real input lives in the dialog it opens.
        <Button
          variant="outline"
          onClick={openDialog}
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
      <GlobalSearchDialog
        open={open}
        onOpenChange={setOpen}
        inputRef={inputRef}
      />
    </>
  );
};

const MIN_SEARCH_LENGTH = 2;
const DEBOUNCE_MS = 300;
const MAX_RESULTS_PER_RESOURCE = 10;
// Results shown per group until the user asks for more, so a busy group does
// not push the others out of view.
const GROUP_PREVIEW_SIZE = 3;

/**
 * Run the global search for an already debounced search term.
 *
 * Stays idle until the term reaches MIN_SEARCH_LENGTH, so opening the dialog
 * does not fire a request. `resources` restricts the query server-side to the
 * resources the current layout can actually link to. The row cap applies to
 * each resource, so every group shows its own newest matches.
 */
const useGlobalSearch = (
  debouncedQuery: string,
  resources: readonly SearchResourceName[],
) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const isEnabled = debouncedQuery.length >= MIN_SEARCH_LENGTH;

  const { data, isPending, error } = useQuery({
    queryKey: ["globalSearch", debouncedQuery, resources],
    queryFn: () =>
      dataProvider.globalSearch(
        debouncedQuery,
        resources,
        MAX_RESULTS_PER_RESOURCE,
      ),
    enabled: isEnabled,
    meta: { persist: false },
    // offlineFirst (the app default) pauses a failed search while offline,
    // leaving the dialog loading forever instead of reporting the error
    networkMode: "always",
  });

  return {
    // on an expired session, ra-core logs out and resolves with { data: {} }
    results: isEnabled && Array.isArray(data) ? data : [],
    isPending: isEnabled && isPending,
    error,
  };
};

type LinkedResult = { result: SearchResult; url: string };

// A title-line excerpt must keep the match on screen, so less lead-in text.
const TITLE_SNIPPET_RADIUS = 25;

const Highlighted = ({ text, terms }: { text: string; terms: string[] }) =>
  highlight(text, terms).map((part, index) =>
    part.isMatch ? (
      <mark
        key={index}
        className="rounded-sm bg-yellow-200 text-inherit dark:bg-yellow-400/30"
      >
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );

export const GlobalSearchDialog = ({
  open,
  onOpenChange,
  inputRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) => {
  const translate = useTranslate();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<
    ReadonlySet<SearchResourceName>
  >(new Set());
  const updateDebouncedQuery = useDebouncedEvent(
    setDebouncedQuery,
    DEBOUNCE_MS,
  );
  const { results, isPending, error } = useGlobalSearch(
    debouncedQuery,
    isMobile ? MOBILE_SEARCH_RESOURCES : DESKTOP_SEARCH_RESOURCES,
  );

  // Resources are already scoped to this layout server-side; this only drops
  // the rare row whose parent record is missing.
  const linkedResults = useMemo(
    () =>
      results.reduce<LinkedResult[]>((acc, result) => {
        const url = getSearchResultUrl(result, isMobile);
        return url ? [...acc, { result, url }] : acc;
      }, []),
    [results, isMobile],
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setQuery("");
      setDebouncedQuery("");
      setExpandedGroups(new Set());
      // replaces an update still pending from the last keystroke
      updateDebouncedQuery("");
    }
    onOpenChange(nextOpen);
  };

  const handleSelect = (url: string) => {
    handleOpenChange(false);
    navigate(url);
  };

  const isTooShort = debouncedQuery.length < MIN_SEARCH_LENGTH;
  const terms = useMemo(() => getSearchTerms(debouncedQuery), [debouncedQuery]);

  const hint = (
    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
      {translate("crm.search.hint", { min: MIN_SEARCH_LENGTH })}
    </div>
  );

  const searchInput = (
    <CommandInput
      ref={inputRef}
      placeholder={translate("crm.search.placeholder")}
      value={query}
      onValueChange={(value) => {
        setQuery(value);
        setExpandedGroups(new Set());
        updateDebouncedQuery(value.trim());
      }}
      // on desktop, keep the text clear of the dialog's close button, drawn
      // over the input's right end
      className={cn("text-base", !isMobile && "pr-8")}
    />
  );

  // results come from the server, already filtered; same look as shadcn's
  // CommandDialog, which this composes from Dialog and Command itself to
  // control the layout and filtering
  const command = (
    <Command
      shouldFilter={false}
      className={cn(
        "[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5",
        isMobile
          ? // cmdk preselects the first item for the Enter key, which a phone
            // lacks: highlight an item only while it is touched
            "[&_[cmdk-item][data-selected=true]]:bg-transparent! [&_[cmdk-item]:active]:bg-muted!"
          : "**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-input]]:h-12",
      )}
    >
      {/* On a phone, a taller input sits next to the close button rather
              than under it, both centered on the same row. */}
      {isMobile ? (
        <div className="flex items-center gap-1 py-2 pl-2 pr-1 *:data-[slot=command-input-wrapper]:flex-1 *:data-[slot=command-input-wrapper]:p-0 **:data-[slot=input-group]:h-11!">
          {searchInput}
          <DrawerClose render={<Button variant="ghost" size="icon-lg" />}>
            <XIcon className="size-5" />
            <span className="sr-only">Close</span>
          </DrawerClose>
        </div>
      ) : (
        searchInput
      )}
      <CommandList
        className={cn(
          "overscroll-contain",
          isMobile ? "max-h-none min-h-0 flex-1" : "max-h-[60vh]",
        )}
        // As in native iOS search, dragging the results closes the
        // keyboard, so the whole list shows.
        onTouchStart={
          isMobile
            ? () => (document.activeElement as HTMLElement | null)?.blur()
            : undefined
        }
      >
        {query.trim() === "" ? (
          <RecentContactsGroup onSelect={handleSelect} fallback={hint} />
        ) : isTooShort ? (
          hint
        ) : error ? (
          <div
            role="alert"
            className="px-4 py-6 text-center text-sm text-destructive"
          >
            {translate("crm.search.error")}
          </div>
        ) : isPending ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            {translate("crm.common.loading")}
          </div>
        ) : (
          <>
            <CommandEmpty className="px-4 py-6 text-center text-sm">
              {translate("crm.search.empty")}
            </CommandEmpty>
            {SEARCH_RESOURCES.map(({ name, icon: Icon, labelKey }) => {
              const groupResults = linkedResults.filter(
                ({ result }) => result.resource === name,
              );
              if (groupResults.length === 0) {
                return null;
              }
              const hiddenCount = expandedGroups.has(name)
                ? 0
                : Math.max(0, groupResults.length - GROUP_PREVIEW_SIZE);
              const shownResults = groupResults.slice(
                0,
                groupResults.length - hiddenCount,
              );
              return (
                <CommandGroup
                  key={name}
                  heading={translate(labelKey)}
                  className="[&_[cmdk-group-heading]]:text-sm"
                >
                  {shownResults.map(({ result, url }) => {
                    const title =
                      result.title || translate("crm.search.untitled_result");
                    // A note's or task's title is the start of its text: when
                    // the match is further in, show the text around it instead.
                    const isTitleFromContent =
                      !!result.content && result.content.startsWith(title);
                    const snippet = result.content
                      ? getSnippet(
                          title,
                          result.content,
                          terms,
                          isTitleFromContent ? TITLE_SNIPPET_RADIUS : undefined,
                        )
                      : null;
                    const displayedTitle =
                      isTitleFromContent && snippet ? snippet : title;
                    const secondLine = isTitleFromContent ? null : snippet;
                    return (
                      <CommandItem
                        key={`${result.resource}.${result.record_id}`}
                        value={`${result.resource}.${result.record_id}`}
                        onSelect={() => handleSelect(url)}
                        className="items-start text-base"
                      >
                        <Icon className="mt-0.5 shrink-0" />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex items-baseline gap-2">
                            <span
                              className={
                                isTitleFromContent ? "line-clamp-2" : "truncate"
                              }
                            >
                              <Highlighted
                                text={displayedTitle}
                                terms={terms}
                              />
                            </span>
                            {result.subtitle ? (
                              <span className="ml-auto shrink-0 text-sm text-muted-foreground">
                                {result.subtitle}
                              </span>
                            ) : null}
                          </div>
                          {secondLine ? (
                            <span className="line-clamp-2 text-sm text-muted-foreground">
                              <Highlighted text={secondLine} terms={terms} />
                            </span>
                          ) : null}
                        </div>
                      </CommandItem>
                    );
                  })}
                  {hiddenCount > 0 ? (
                    <CommandItem
                      value={`${name}.show_more`}
                      onSelect={() =>
                        setExpandedGroups(
                          (groups) => new Set([...groups, name]),
                        )
                      }
                      className="text-sm text-muted-foreground"
                    >
                      <ChevronDown className="shrink-0" />
                      {translate("crm.search.show_more")}
                    </CommandItem>
                  ) : null}
                </CommandGroup>
              );
            })}
          </>
        )}
      </CommandList>
    </Command>
  );

  // Mobile: the whole screen. A drawer rather than a dialog, as it keeps the
  // list above the keyboard and stops drags from scrolling the page behind it.
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerVirtualKeyboardProvider>
          <DrawerContent
            // openDialog focuses the input, during the tap
            initialFocus={false}
            className="h-dvh max-h-none data-[swipe-direction=down]:rounded-t-none pb-(--drawer-keyboard-inset)"
          >
            <DrawerTitle className="sr-only">
              {translate("crm.search.title")}
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              {translate("crm.search.placeholder")}
            </DrawerDescription>
            {command}
          </DrawerContent>
        </DrawerVirtualKeyboardProvider>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Pinned near the top so the box grows downwards as results arrive
          instead of re-centering on every keystroke. */}
      <DialogContent className="overflow-hidden p-0 top-[12vh] translate-y-0 sm:max-w-xl">
        {/* inside the content, so nothing renders while the dialog is closed */}
        <DialogHeader className="sr-only">
          <DialogTitle>{translate("crm.search.title")}</DialogTitle>
          <DialogDescription>
            {translate("crm.search.placeholder")}
          </DialogDescription>
        </DialogHeader>
        {command}
      </DialogContent>
    </Dialog>
  );
};
