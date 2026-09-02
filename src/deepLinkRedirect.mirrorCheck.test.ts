import { beforeAll, describe, expect, it } from "vitest";
import { deepLinkRedirectCases } from "./deepLinkRedirect.fixtures";

// Guards the exact drift class this slice's own audit already found twice
// elsewhere (public_application/index.ts vs. submitApplication.ts;
// acuity_webhook vs. rescheduleSalesCall.ts): public/404.html hand-mirrors
// src/deepLinkRedirect.ts's computeDeepLinkRedirect (GitHub Pages serves
// public/ verbatim — Vite never processes it, so 404.html can't import the
// module directly). This test extracts 404.html's actual inline <script>,
// runs it for real against the SAME cases deepLinkRedirect.test.ts checks
// the canonical implementation with, and asserts they still agree. A future
// edit to one that isn't mirrored to the other fails here.
let shimHtml: string;
// Fetched, not imported: public/404.html is a real static asset (Vite never
// processes public/, and a source-import of a public/ file is explicitly
// unsupported — vitest-browser-mode's real dev server serves it at its
// actual URL exactly as GitHub Pages will, so this is the most faithful way
// to obtain its literal bytes for the mirror check below.
beforeAll(async () => {
  shimHtml = await fetch("/404.html").then((response) => response.text());
});

const extractInlineScript = (html: string): string => {
  const match = /<script>([\s\S]*?)<\/script>/.exec(html);
  if (!match) {
    throw new Error("public/404.html: expected exactly one <script> block");
  }
  return match[1];
};

const runShim = (
  pathname: string,
  search: string,
): { redirectedTo: string | null; shownNotFound: boolean } => {
  let redirectedTo: string | null = null;
  let shownNotFound = false;

  const fakeWindow = {
    location: {
      pathname,
      search,
      replace(url: string) {
        redirectedTo = url;
      },
    },
  };
  const fakeDocument = {
    getElementById(id: string) {
      if (id !== "not-found") return null;
      return {
        set hidden(value: boolean) {
          shownNotFound = value === false;
        },
      };
    },
  };

  // The shim's own IIFE only ever reads `window`/`document` — binding them
  // as parameters shadows the real globals for this one execution, in
  // whichever Vitest environment (browser or Node) this test happens to run
  // under, with no environment-specific sandboxing API needed.
  const runInlineScript = new Function(
    "window",
    "document",
    extractInlineScript(shimHtml),
  );
  runInlineScript(fakeWindow, fakeDocument);

  return { redirectedTo, shownNotFound };
};

describe("public/404.html mirrors src/deepLinkRedirect.ts", () => {
  for (const { name, pathname, search, expected } of deepLinkRedirectCases) {
    it(name, () => {
      const { redirectedTo, shownNotFound } = runShim(pathname, search);
      if (expected === null) {
        expect(redirectedTo).toBeNull();
        expect(shownNotFound).toBe(true);
      } else {
        expect(redirectedTo).toBe(expected);
        expect(shownNotFound).toBe(false);
      }
    });
  }
});
