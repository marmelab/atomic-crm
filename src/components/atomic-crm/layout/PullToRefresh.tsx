import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, RotateCw } from "lucide-react";
import { useTranslate } from "ra-core";
import { useCallback, useEffect, useRef, useState } from "react";

/** Finger travel below which we cannot tell a pull from a tap, so we stay passive. */
const GESTURE_SLOP = 8;
/** Finger travel is damped by this factor, which is what makes the pull feel elastic. */
const DRAG_RESISTANCE = 0.5;
/** How far the control must travel before releasing triggers a refresh. */
const TRIGGER_DISTANCE = 64;
/** The control never travels further than this, however hard the user pulls. */
const MAX_DISTANCE = 96;
/** Keep the spinner up at least this long, so a cache-warm refresh is not a flash. */
const MIN_SPINNER_MS = 400;

/**
 * True when a pull starting on `target` should scroll the page rather than refresh it:
 * some ancestor is already scrolled down, or the touch is inside a dialog/sheet, which
 * owns its own scrolling.
 */
const isScrollGesture = (target: EventTarget | null) => {
  let node = target instanceof Element ? target : null;
  if (node?.closest('[role="dialog"], [data-vaul-drawer]')) {
    return true;
  }
  while (node) {
    if (node.scrollTop > 0) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
};

/**
 * Mobile pull-to-refresh: pulling down from the top of the page reveals a refresh
 * button that follows the finger, and releasing it past the trigger distance refetches
 * every active query — the mobile equivalent of the desktop <RefreshButton>, which is
 * hidden on small screens. Tapping the button while it is visible refreshes too.
 *
 * Mounted once by <MobileLayout>: it listens on the document, so it covers every mobile
 * page without each of them having to opt in.
 */
export const PullToRefresh = () => {
  const queryClient = useQueryClient();
  const translate = useTranslate();
  const [distance, setDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // The gesture runs on raw DOM events, so its inputs are read from refs rather than
  // from state, which would be a render behind.
  const distanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const startYRef = useRef<number | null>(null);

  const moveTo = useCallback((value: number) => {
    distanceRef.current = value;
    setDistance(value);
  }, []);

  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) {
      return;
    }
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    moveTo(TRIGGER_DISTANCE);
    try {
      // Same effect as ra-core's useRefresh, but awaitable so the spinner can stop
      // when the data has actually come back.
      await Promise.all([
        queryClient.invalidateQueries(),
        new Promise((resolve) => setTimeout(resolve, MIN_SPINNER_MS)),
      ]);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      moveTo(0);
    }
  }, [moveTo, queryClient]);

  useEffect(() => {
    const onTouchStart = (event: TouchEvent) => {
      startYRef.current =
        event.touches.length === 1 &&
        !isRefreshingRef.current &&
        !isScrollGesture(event.target)
          ? event.touches[0].clientY
          : null;
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
      // We own the gesture from here: suppress the native overscroll, which on Chrome
      // for Android is its own pull-to-refresh reloading the whole page.
      event.preventDefault();
      moveTo(Math.min(MAX_DISTANCE, (delta - GESTURE_SLOP) * DRAG_RESISTANCE));
    };

    const onTouchEnd = () => {
      if (startYRef.current === null) {
        return;
      }
      startYRef.current = null;
      if (distanceRef.current >= TRIGGER_DISTANCE) {
        void refresh();
      } else {
        moveTo(0);
      }
    };

    const onTouchCancel = () => {
      startYRef.current = null;
      moveTo(0);
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchCancel);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [moveTo, refresh]);

  if (distance === 0 && !isRefreshing) {
    return null;
  }

  const progress = Math.min(1, distance / TRIGGER_DISTANCE);

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center pointer-events-none">
      <button
        type="button"
        aria-label={translate("ra.action.refresh")}
        disabled={isRefreshing}
        onClick={() => void refresh()}
        className="-mt-12 flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-md pointer-events-auto"
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
      </button>
    </div>
  );
};
