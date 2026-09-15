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
import {
  DESKTOP_SEARCH_RESOURCES,
  MOBILE_SEARCH_RESOURCES,
  SEARCH_RESOURCES,
} from "./searchResources";
import { MIN_SEARCH_LENGTH, useGlobalSearch } from "./useGlobalSearch";

type LinkedResult = { result: SearchResult; url: string };

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

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={translate("crm.search.title")}
      description={translate("crm.search.placeholder")}
      shouldFilter={false}
    >
      <CommandInput
        placeholder={translate("crm.search.placeholder")}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[60vh]">
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
                  {groupResults.map(({ result, url }) => (
                    <CommandItem
                      key={result.id}
                      value={String(result.id)}
                      onSelect={() => handleSelect(url)}
                    >
                      <Icon className="shrink-0" />
                      <span className="truncate">
                        {result.title ||
                          translate("crm.search.untitled_result")}
                      </span>
                      {result.subtitle ? (
                        <span className="ml-auto shrink-0 pl-2 text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};
