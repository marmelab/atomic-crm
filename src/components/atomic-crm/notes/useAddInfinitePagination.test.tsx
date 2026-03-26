import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { ListContextProvider } from "ra-core";
import { useAddInfinitePagination } from "./useAddInfinitePagination";

const firstPageNotes = [
  { contact_id: 4, date: "2026-03-17T13:50:00.000Z", id: 9, sales_id: 0 },
];

type HookSnapshot = {
  hasNextPage: boolean;
  noteIds: number[];
};

// Keep the list context fixed on the initial first page so the test can
// inspect what the hook exposes before that page is persisted into allPages.
const HookStateHarness = ({ snapshots }: { snapshots: HookSnapshot[] }) => {
  const listContext = {
    data: firstPageNotes,
    defaultTitle: undefined,
    displayedFilters: {},
    error: null,
    exporter: false,
    filterValues: {},
    hasNextPage: false,
    hasPreviousPage: false,
    hideFilter: vi.fn(),
    isFetching: false,
    isLoading: false,
    isPending: false,
    isPaused: false,
    onSelect: vi.fn(),
    onSelectAll: vi.fn(),
    onToggleItem: vi.fn(),
    onUnselectItems: vi.fn(),
    page: 1,
    perPage: 25,
    refetch: vi.fn(),
    resource: "contact_notes",
    selectedIds: [],
    setFilters: vi.fn(),
    setPage: vi.fn(),
    setPerPage: vi.fn(),
    setSort: vi.fn(),
    showFilter: vi.fn(),
    sort: { field: "date", order: "DESC" },
    total: 1,
  } as any;

  return (
    <ListContextProvider value={listContext}>
      <HookStateHarnessBody snapshots={snapshots} />
    </ListContextProvider>
  );
};

const HookStateHarnessBody = ({ snapshots }: { snapshots: HookSnapshot[] }) => {
  const { data, infinitePaginationContextValue } = useAddInfinitePagination();

  snapshots.push({
    hasNextPage: infinitePaginationContextValue.hasNextPage,
    noteIds: data.map((note) => note.id),
  });

  return null;
};

describe("useAddInfinitePagination integration", () => {
  it("exposes the current first-page data before allPages is populated", async () => {
    const snapshots: HookSnapshot[] = [];

    await render(<HookStateHarness snapshots={snapshots} />);

    expect(snapshots[0]).toEqual({
      hasNextPage: false,
      noteIds: [9],
    });
  });
});
