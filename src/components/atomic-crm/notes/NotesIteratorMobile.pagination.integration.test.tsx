import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { ListContextProvider } from "ra-core";
import {
  createCrmDb,
  createCrmScenario,
  CrmTestProvider,
} from "@/test/browser/atomic-crm/crmUiHarness";
import { NotesIteratorMobile } from "./NotesIteratorMobile";

const singleNote = {
  contact_id: 3,
  date: "2026-03-17T13:50:00.000Z",
  id: 9,
  sales_id: 0,
  status: "warm",
  text: "Only note in the list",
};

// Trigger the infinite-pagination sentinel immediately in tests so we can
// assert whether mounting the list would request another page.
class ImmediateIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  disconnect() {}

  observe(target: Element) {
    this.callback(
      [
        {
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRatio: 1,
          intersectionRect: target.getBoundingClientRect(),
          isIntersecting: true,
          rootBounds: null,
          target,
          time: Date.now(),
        },
      ],
      this,
    );
  }

  takeRecords() {
    return [];
  }

  unobserve() {}
}

const NotesIteratorHarness = ({
  setPage,
}: {
  setPage: ReturnType<typeof vi.fn>;
}) => {
  const listContext = {
    data: [singleNote],
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
    isPaused: false,
    isPending: false,
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
    setPage,
    setPerPage: vi.fn(),
    setSort: vi.fn(),
    showFilter: vi.fn(),
    sort: { field: "date", order: "DESC" },
    total: 1,
  } as any;

  return (
    <ListContextProvider value={listContext}>
      <NotesIteratorMobile contactId={3} showStatus />
    </ListContextProvider>
  );
};

describe("NotesIteratorMobile pagination integration", () => {
  it("does not request the next page on mount when the first page already contains the full result set", async () => {
    const originalIntersectionObserver = window.IntersectionObserver;
    window.IntersectionObserver =
      ImmediateIntersectionObserver as unknown as typeof IntersectionObserver;

    try {
      const setPage = vi.fn();
      const scenario = createCrmScenario({
        db: createCrmDb(),
        latency: 0,
      });

      const screen = await render(
        <CrmTestProvider scenario={scenario}>
          <NotesIteratorHarness setPage={setPage} />
        </CrmTestProvider>,
      );

      await expect
        .element(screen.getByText("Only note in the list"))
        .toBeInTheDocument();
      expect(setPage).not.toHaveBeenCalled();
    } finally {
      window.IntersectionObserver = originalIntersectionObserver;
    }
  });
});
