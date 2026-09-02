// GitHub Pages deep-link shim (Native Application Intake slice, real-hosting
// repair): this app is deployed to GitHub Pages (see .github/workflows/
// deploy.yml's "Deploy GitHub pages" steps and package.json's ghpages:deploy
// script) — a pure static host with no server-side rewrite config — and its
// whole tree is wrapped in ra-core's default HashRouter (see CRM.tsx's own
// comment on DesktopAdmin's <CustomRoutes noLayout> block for why: keeping
// one shared router instance is what lets a public submission and the CRM's
// own read of that data share the same live dataProvider, and a prior
// standalone BrowserRouter caused submitted data to never appear). HashRouter
// only ever matches on the URL fragment (the part after "#"), so a plain,
// no-fragment link like ".../apply/living-example" resolves to nothing the
// router recognizes, and on GitHub Pages specifically it's worse than that:
// GitHub Pages returns a real 404 for any path with no matching file at all
// (there is no server-side SPA fallback the way Vite's dev server has one).
//
// GitHub Pages does let a repo serve its own public/404.html verbatim
// (at the SAME URL the visitor requested — the browser's address bar/
// location does not change) for exactly that case. This module is the pure,
// testable "what should 404.html do" decision: given the pathname+search of
// a request GitHub Pages couldn't resolve, return the same-origin hash-
// routed URL to redirect to, or null if this isn't one of the app's known
// public deep-link routes at all (a genuine broken link or a missing static
// asset — see DEEP_LINK_PATTERNS below for why this is deliberately an
// allowlist, not a catch-all).
//
// public/404.html is a plain static file GitHub Pages serves verbatim —
// Vite does not process public/, so its own inline <script> can't import
// this module directly. It hand-mirrors the same logic instead, the exact
// constraint (and the exact convention) every Deno Edge Function in
// supabase/functions/ already works around by hand-mirroring its own src/
// reference implementation (see e.g. public_application/index.ts's own
// top-of-file comment). deepLinkRedirect.mirrorCheck.test.ts asserts the two
// implementations agree on the same cases, closing the exact "the two
// mirrors silently drifted apart" bug class this slice's own audit already
// found twice elsewhere (public_application/index.ts's missing
// syncWaitlistForActiveDeal call; acuity_webhook's missing cancelled-
// reschedule guard, from the prior slice).

const DEEP_LINK_PATTERNS: RegExp[] = [
  /\/apply\/living-example\/?$/,
  /\/apply\/growing-yourself-up\/[^/]+\/?$/,
];

export const computeDeepLinkRedirect = (
  pathname: string,
  search: string,
): string | null => {
  for (const pattern of DEEP_LINK_PATTERNS) {
    const match = pattern.exec(pathname);
    if (!match) continue;
    const route = match[0].replace(/\/$/, "");
    const base = pathname.slice(0, match.index);
    return `${base}/#${route}${search}`;
  }
  return null;
};
