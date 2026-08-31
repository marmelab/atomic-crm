import * as React from "react";

const MOBILE_BREAKPOINT = 768;

// Routing/shell regression (Programs + Opportunity UX Chaos Monkey pass):
// relying on matchMedia's own "change" event alone is not reliable for every
// way a viewport can change size — confirmed reproducible with a
// CDP-driven/emulated resize (and plausibly some real-world window-manager
// resize/snap sequences too): the media query itself evaluates correctly on
// demand, but its "change" listener never re-fires, so `isMobile` gets stuck
// at whatever it first resolved to. Since CRM.tsx switches between an
// entirely different Resource/route set (DesktopAdmin vs MobileAdmin) based
// on this value, getting stuck is not cosmetic — it strands the user on a
// route set that doesn't have the page they're trying to reach, with no way
// back short of a hard reload at the right width. `window`'s own `resize`
// event is dispatched directly by the browser's layout engine on every
// width/height change and is the standard, robust signal for this; matchMedia
// is kept as a secondary listener (cheap, and correct where it does fire).
//
// The initial state deliberately stays `undefined` (not a lazy
// `window.innerWidth` read): resolving synchronously on the very first
// render — instead of the original one-tick `undefined -> false -> real
// value` sequence — reproducibly broke an unrelated, pre-existing mobile
// Contact-edit test (ContactEdit.test.tsx) that turned out to depend on
// that exact timing. The one-tick settle is harmless (same as before this
// fix); only the later-resize robustness is new.
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);

  return !!isMobile;
}
