import { useCallback, useEffect, useState } from "react";

import type { PublicOfferContext } from "./publicOfferContext";

// Loading the form's context, with somewhere to land when it fails.
//
// Both public pages did this:
//
//   dataSource.getX().then((result) => setContext(result));
//
// with no catch. The data source THROWS when the application service
// cannot be reached, so a rejection left the state on "pending" forever
// and the page returned null — a blank screen that never resolves, with
// nothing on it to explain or retry. That is what a prospective client saw
// while Leif waited for their application.
//
// A public form is the one surface where the visitor cannot be asked to
// open a console, so failure has to be a visible, bounded state.
export type PublicOfferContextState =
  | { status: "loading" }
  | { status: "ready"; context: PublicOfferContext }
  | { status: "failed"; retry: () => void };

export const usePublicOfferContext = (
  load: () => Promise<PublicOfferContext>,
): PublicOfferContextState => {
  const [state, setState] = useState<PublicOfferContextState>({
    status: "loading",
  });
  // Bumped by retry to re-run the effect without reordering hooks.
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((context) => {
        if (!cancelled) setState({ status: "ready", context });
      })
      .catch(() => {
        // Deliberately no detail: the visitor cannot act on a database or
        // network error, and it is not theirs to see.
        if (!cancelled) setState({ status: "failed", retry });
      });
    return () => {
      cancelled = true;
    };
    // `load` is a fresh closure on every render in both callers, so it is
    // deliberately not a dependency — attempt is what re-runs this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, retry]);

  return state;
};
