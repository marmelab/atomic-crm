// Shared test cases for computeDeepLinkRedirect (src/deepLinkRedirect.ts)
// and its static hand-mirror (public/404.html's inline <script>). Both
// deepLinkRedirect.test.ts and deepLinkRedirect.mirrorCheck.test.ts run the
// SAME cases against their respective implementation, so a future change to
// one that isn't mirrored to the other fails a test instead of silently
// drifting — see deepLinkRedirect.ts's own comment for why this mirroring
// exists at all.
export type DeepLinkRedirectCase = {
  name: string;
  pathname: string;
  search: string;
  expected: string | null;
};

export const deepLinkRedirectCases: DeepLinkRedirectCase[] = [
  {
    name: "root-site Living Example",
    pathname: "/apply/living-example",
    search: "",
    expected: "/#/apply/living-example",
  },
  {
    name: "project-page (subpath) Living Example",
    pathname: "/leif-crm-atomic/apply/living-example",
    search: "",
    expected: "/leif-crm-atomic/#/apply/living-example",
  },
  {
    name: "Growing Yourself Up with a cohort id",
    pathname: "/apply/growing-yourself-up/42",
    search: "",
    expected: "/#/apply/growing-yourself-up/42",
  },
  {
    name: "query params preserved, moved inside the hash fragment",
    pathname: "/apply/living-example",
    search: "?utm_source=instagram",
    expected: "/#/apply/living-example?utm_source=instagram",
  },
  {
    name: "trailing slash normalized",
    pathname: "/apply/living-example/",
    search: "",
    expected: "/#/apply/living-example",
  },
  {
    name: "bare growing-yourself-up path with no cohort id (trailing slash)",
    pathname: "/apply/growing-yourself-up/",
    search: "",
    expected: null,
  },
  {
    name: "bare growing-yourself-up path with no cohort id (no slash)",
    pathname: "/apply/growing-yourself-up",
    search: "",
    expected: null,
  },
  {
    name: "extra trailing segments past a known route",
    pathname: "/apply/living-example/extra/junk",
    search: "",
    expected: null,
  },
  {
    name: "unrelated broken link",
    pathname: "/totally/fake/path",
    search: "",
    expected: null,
  },
  {
    name: "missing static asset (JS bundle)",
    pathname: "/assets/index-abc123.js",
    search: "",
    expected: null,
  },
  {
    name: "missing static asset (favicon)",
    pathname: "/favicon.ico",
    search: "",
    expected: null,
  },
  {
    name: "site root",
    pathname: "/",
    search: "",
    expected: null,
  },
];
