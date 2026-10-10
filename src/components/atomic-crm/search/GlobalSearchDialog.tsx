import { useTranslate } from "ra-core";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useIsMobile } from "@/hooks/use-mobile";

import type { SearchResult } from "../types";
import { getSearchResultUrl } from "./getSearchResultUrl";
import { getSearchTerms, getSnippet, highlight } from "./searchHighlight";
import {
  DESKTOP_SEARCH_RESOURCES,
  MOBILE_SEARCH_RESOURCES,
  SEARCH_RESOURCES,
} from "./searchResources";
import { MIN_SEARCH_LENGTH, useGlobalSearch } from "./useGlobalSearch";

type LinkedResult = { result: SearchResult; url: string };

// Desktop: pinned near the top so the box grows downwards as results arrive
// instead of re-centering on every keystroke. Mobile: the whole screen.
const DESKTOP_DIALOG_CLASSES = "top-[12vh] translate-y-0 sm:max-w-xl";
const MOBILE_DIALOG_CLASSES =
  "inset-0 h-dvh max-w-none translate-x-0 translate-y-0 grid-rows-[minmax(0,1fr)] rounded-none border-0 sm:max-w-none";

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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const translate = useTranslate();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const { results, isPending, error, debouncedQuery } = useGlobalSearch(
    query,
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
    }
    onOpenChange(nextOpen);
  };

  const handleSelect = (url: string) => {
    handleOpenChange(false);
    navigate(url);
  };

  const isTooShort = debouncedQuery.length < MIN_SEARCH_LENGTH;
  const terms = useMemo(() => getSearchTerms(debouncedQuery), [debouncedQuery]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={translate("crm.search.title")}
      description={translate("crm.search.placeholder")}
      shouldFilter={false}
      className={isMobile ? MOBILE_DIALOG_CLASSES : DESKTOP_DIALOG_CLASSES}
    >
      <CommandInput
        placeholder={translate("crm.search.placeholder")}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className={isMobile ? "max-h-none flex-1" : "max-h-[60vh]"}>
        {isTooShort ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {translate("crm.search.hint", { min: MIN_SEARCH_LENGTH })}
          </div>
        ) : error ? (
          <div
            role="alert"
            className="py-6 text-center text-sm text-destructive"
          >
            {translate("crm.search.error")}
          </div>
        ) : isPending ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {translate("crm.common.loading")}
          </div>
        ) : (
          <>
            <CommandEmpty>{translate("crm.search.empty")}</CommandEmpty>
            {SEARCH_RESOURCES.map(({ name, icon: Icon, labelKey }) => {
              const groupResults = linkedResults.filter(
                ({ result }) => result.resource === name,
              );
              if (groupResults.length === 0) {
                return null;
              }
              return (
                <CommandGroup key={name} heading={translate(labelKey)}>
                  {groupResults.map(({ result, url }) => {
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
                        key={result.id}
                        value={String(result.id)}
                        onSelect={() => handleSelect(url)}
                        className="items-start"
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
                              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                                {result.subtitle}
                              </span>
                            ) : null}
                          </div>
                          {secondLine ? (
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              <Highlighted text={secondLine} terms={terms} />
                            </span>
                          ) : null}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};
