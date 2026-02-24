import { useListContext } from "ra-core";
import { useEffect, useMemo, useState } from "react";

export const useAddInfinitePagination = () => {
  const { data, error, isPending, page, setPage, total, refetch } =
    useListContext();

  const [allPages, setAllPages] = useState<Record<number, any[]>>({});

  useEffect(() => {
    if (!data) {
      return;
    }
    setAllPages((prev) => ({ ...prev, [page]: data }));
  }, [page, setAllPages, data]);

  const allLoadedData = useMemo(() => {
    // Sort pages by page number and flatten the data
    return Object.entries(allPages)
      .sort(([pageA], [pageB]) => Number(pageA) - Number(pageB))
      .flatMap(([, pageData]) => pageData);
  }, [allPages]);

  return {
    isPending,
    error,
    data: allLoadedData,
    refetch,
    infinitePaginationContextValue: {
      fetchNextPage: async (): Promise<any> => {
        setPage(page + 1);
      },
      hasNextPage: allLoadedData.length < (total ?? 0),
      isFetchingNextPage: isPending,
      fetchPreviousPage: async (): Promise<any> => {
        setPage(page - 1);
      },
      hasPreviousPage: page > 1,
      isFetchingPreviousPage: false,
    },
  };
};
