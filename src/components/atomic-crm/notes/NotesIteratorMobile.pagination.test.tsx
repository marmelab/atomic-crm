import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { SingleNote } from "./NotesIteratorMobile.pagination.stories";

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

describe("NotesIteratorMobile pagination", () => {
  it("does not request the next page on mount when the first page already contains the full result set", async () => {
    const originalIntersectionObserver = window.IntersectionObserver;
    window.IntersectionObserver =
      ImmediateIntersectionObserver as unknown as typeof IntersectionObserver;

    try {
      const setPage = vi.fn();

      const screen = await render(<SingleNote setPage={setPage} />);

      await expect
        .element(screen.getByText("Only note in the list"))
        .toBeInTheDocument();
      expect(setPage).not.toHaveBeenCalled();
    } finally {
      window.IntersectionObserver = originalIntersectionObserver;
    }
  });
});
