import { useMemo } from "react";

import { artworks } from "./artworks";
import { getDenverDateString, selectDailyArtwork } from "./selectDailyArtwork";

// Recomputes only when the Denver calendar date actually changes (i.e. once
// per page load in practice) — no live midnight refresh, per the brief's
// "keep this simple" guidance. A held-open tab won't flip to the next
// artwork until reloaded; that's an accepted simplification.
export const useDailyArtwork = () => {
  return useMemo(() => {
    const dateString = getDenverDateString();
    return { artwork: selectDailyArtwork(artworks, dateString), dateString };
  }, []);
};
