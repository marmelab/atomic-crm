import { LoaderCircle, RotateCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useRefreshData } from "./useRefreshData";

/** Finger travel below which we cannot tell a pull from a tap, so we stay passive. */
const GESTURE_SLOP = 8;
/** Finger travel is damped by this factor, which is what makes the pull feel elastic. */
const DRAG_RESISTANCE = 0.5;
/** How far the control must travel before releasing triggers a refresh. */
const TRIGGER_DISTANCE = 64;
/** The control never travels further than this, however hard the user pulls. */
const MAX_DISTANCE = 96;

/** True when the element scrolls on its own and has somewhere to scroll to. */
const isScroller = (node: Element) => {
  const { overflowY } = getComputedStyle(node);
  return (
    (overflowY === "auto" || overflowY === "scroll") &&
    node.scrollHeight > node.clientHeight
  );
};

/**
 * True when a pull starting on `target` belongs to something else than the page: an
 * ancestor scrolls on its own or is already scrolled down, or the touch is inside an
 * overlay. Overlays are matched on their two portal roots — Radix's popper wrapper
 * (select, dropdown menu, popover, command) and the dialog role (dialog and, since
 * vaul renders one too, sheet) — rather than on the role of the panel itself, which
 * varies (dialog, listbox, menu, …) and is portalled out of its own sheet anyway.
 */
const isScrollGesture = (target: EventTarget | null) => {
  let node = target instanceof Element ? target : null;
  if (node?.closest('[role="dialog"], [data-radix-popper-content-wrapper]')) {
    return true;
  }
  while (node) {
    if (node.scrollTop > 0 || isScroller(node)) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
};

/**
 * Mobile pull-to-refresh: pulling down from the top of the page reveals an indicator
 * that follows the finger, and releasing it past the trigger distance refetches every
 * active query. The indicator is decorative — the gesture's accessible counterpart is
 * the <MobileRefreshButton> in the header.
 *
 * Mounted once by <MobileLayout>: it listens on the document, so it covers every mobile
 * page without each of them having to opt in. Native overscroll (Chrome for Android's
 * own pull-to-refresh, the iOS rubber-band) is suppressed in CSS, by the
 * `overscroll-behavior-y: none` in index.css, so all our listeners stay passive.
 */
export const PullToRefresh = () => {
  const { refresh, isRefreshing } = useRefreshData();
  const [distance, setDistance] = useState(0);
  // The gesture runs on raw DOM events, so its inputs are read from refs rather than
  // from state, which would be a render behind.
  const distanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  const moveTo = useCallback((value: number) => {
    distanceRef.current = value;
    setDistance(value);
  }, []);

  // Holds the indicator at the trigger distance for as long as the refresh runs.
  const pullRefresh = useCallback(async () => {
    isRefreshingRef.current = true;
    moveTo(TRIGGER_DISTANCE);
    try {
      await refresh();
    } finally {
      moveTo(0);
    }
  }, [moveTo, refresh]);

  useEffect(() => {
    const onTouchStart = (event: TouchEvent) => {
      if (
        event.touches.length !== 1 ||
        isRefreshingRef.current ||
        isScrollGesture(event.target)
      ) {
        // Not our gesture. A second finger landing mid-pull ends up here, so drop the
        // indicator too, or it would stay on screen and stay armed.
        startYRef.current = null;
        if (!isRefreshingRef.current) {
          moveTo(0);
        }
        return;
      }
      startYRef.current = event.touches[0].clientY;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (startYRef.current === null) {
        return;
      }
      const delta = event.touches[0].clientY - startYRef.current;
      if (delta <= GESTURE_SLOP) {
        moveTo(0);
        return;
      }
      moveTo(Math.min(MAX_DISTANCE, (delta - GESTURE_SLOP) * DRAG_RESISTANCE));
    };

    const onTouchEnd = () => {
      const startY = startYRef.current;
      startYRef.current = null;
      if (isRefreshingRef.current) {
        return;
      }
      if (startY !== null && distanceRef.current >= TRIGGER_DISTANCE) {
        void pullRefresh();
      } else {
        // Also covers the abandoned pull of a gesture we gave up on mid-way.
        moveTo(0);
      }
    };

    const onTouchCancel = () => {
      startYRef.current = null;
      moveTo(0);
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [moveTo, pullRefresh]);

  if (distance === 0 && !isRefreshing) {
    return null;
  }

  const progress = Math.min(1, distance / TRIGGER_DISTANCE);

  return (
    <div
      aria-hidden="true"
      data-testid="pull-to-refresh"
      className="fixed inset-x-0 top-0 z-50 flex justify-center pointer-events-none"
    >
      <div
        className="-mt-12 flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-md"
        style={{
          transform: `translateY(${distance}px)`,
          opacity: isRefreshing ? 1 : progress,
        }}
      >
        {isRefreshing ? (
          <LoaderCircle className="size-5 animate-spin" />
        ) : (
          <RotateCw
            className="size-5"
            style={{ transform: `rotate(${progress * 270}deg)` }}
          />
        )}
      </div>
    </div>
  );
};
