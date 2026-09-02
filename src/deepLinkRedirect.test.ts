import { describe, expect, it } from "vitest";
import { computeDeepLinkRedirect } from "./deepLinkRedirect";
import { deepLinkRedirectCases } from "./deepLinkRedirect.fixtures";

describe("computeDeepLinkRedirect", () => {
  for (const { name, pathname, search, expected } of deepLinkRedirectCases) {
    it(name, () => {
      expect(computeDeepLinkRedirect(pathname, search)).toBe(expected);
    });
  }
});
