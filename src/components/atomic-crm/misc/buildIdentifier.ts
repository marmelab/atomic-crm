// Which build is this browser running?
//
// A whole acceptance round was spent on fixes that were deployed and
// correct while the browser in front of Leif served a cached older shell.
// "It's not fixed" and "your tab is stale" were indistinguishable, and
// neither of us could settle it.
//
// Stamped at build time and logged once on start, so the answer is one
// glance at the console rather than an argument. Deliberately not in the
// UI: it is a diagnostic, not something Leif should have to look at while
// working. No secrets — it is a timestamp.
declare const __BUILD_ID__: string;

export const BUILD_ID: string =
  typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";

export const announceBuild = (): void => {
  // eslint-disable-next-line no-console
  console.info(
    `%cLeif CRM build ${BUILD_ID}`,
    "color:#6b7280",
    "— if a fix looks missing, compare this with the deployed build before anything else.",
  );
};
