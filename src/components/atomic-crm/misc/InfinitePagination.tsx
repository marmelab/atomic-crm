import * as React from "react";
import { useEffect, useRef } from "react";
import {
  useInfinitePaginationContext,
  useListContext,
  useEvent,
} from "ra-core";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/admin/spinner";

/**
 * A pagination component that loads more results when the user scrolls to the bottom of the list.
 *
 * Used as the default pagination component in the <InfiniteList> component.
 *
 * @example
 * import { InfiniteList, InfinitePagination, Datagrid, TextField } from 'react-admin';
 *
 * const PostList = () => (
 *    <InfiniteList pagination={<InfinitePagination sx={{ py: 5 }} />}>
 *       <Datagrid>
 *          <TextField source="id" />
 *         <TextField source="title" />
 *      </Datagrid>
 *   </InfiniteList>
 * );
 */
export const InfinitePagination = ({
  offline = null,
  options = defaultOptions,
}: InfinitePaginationProps) => {
  const { isPaused, isPending } = useListContext();
  const { fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfinitePaginationContext();

  if (!fetchNextPage) {
    throw new Error(
      "InfinitePagination must be used inside an InfinitePaginationContext, usually created by <InfiniteList>. You cannot use it as child of a <List> component.",
    );
  }

  const [hasRequestedNextPage, setHasRequestedNextPage] = React.useState(false);
  const observerElem = useRef(null);
  const handleObserver = useEvent<[IntersectionObserverEntry[]], void>(
    (entries) => {
      const [target] = entries;
      if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
        setHasRequestedNextPage(true);
        fetchNextPage();
      }
    },
  );

  useEffect(() => {
    // Whenever the query is unpaused, reset the requested next page state
    if (!isPaused) {
      setHasRequestedNextPage(false);
    }
  }, [isPaused]);

  useEffect(() => {
    const element = observerElem.current;
    if (!element) return;
    const observer = new IntersectionObserver(handleObserver, options);
    observer.observe(element);
    return () => observer.unobserve(element);
  }, [
    fetchNextPage,
    hasNextPage,
    handleObserver,
    options,
    isPending,
    isFetchingNextPage,
  ]);

  if (isPending) return null;

  const showOffline =
    isPaused &&
    hasNextPage &&
    hasRequestedNextPage &&
    offline !== false &&
    offline !== undefined;

  return (
    <div ref={observerElem} className="py-2 text-center">
      {showOffline ? (
        offline
      ) : isFetchingNextPage && hasNextPage ? (
        <Item variant="default">
          <ItemMedia>
            <Spinner />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="line-clamp-1">Loading...</ItemTitle>
          </ItemContent>
        </Item>
      ) : (
        <Item variant="default">
          <ItemContent>
            <ItemTitle className="line-clamp-1">&nbsp;</ItemTitle>
          </ItemContent>
        </Item>
      )}
    </div>
  );
};

const defaultOptions = { threshold: 0 };

export interface InfinitePaginationProps {
  offline?: React.ReactNode;
  options?: IntersectionObserverInit;
}
