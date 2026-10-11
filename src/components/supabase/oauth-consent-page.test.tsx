import {
  CoreAdminContext,
  memoryStore,
  TestMemoryRouter,
  type AuthProvider,
} from "ra-core";
import { Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { testI18nProvider } from "@/components/atomic-crm/providers/commons/i18nProvider";

import { OAuthConsentPage } from "./oauth-consent-page";

const authorizationDetails = {
  authorization_id: "auth-123",
  redirect_uri: "http://localhost:9/callback",
  client: { id: "client-1", name: "Claude Code", uri: "", logo_uri: "" },
  user: { id: "user-1", email: "jane@example.com" },
  scope: "email",
};

const LoginSpy = () => {
  const { state } = useLocation();
  return (
    <p>
      Login page, next: {state?.nextPathname}
      {state?.nextSearch}
    </p>
  );
};

const renderConsentPage = (authProvider: Partial<AuthProvider>) =>
  render(
    <TestMemoryRouter
      initialEntries={["/oauth/consent?authorization_id=auth-123"]}
    >
      <CoreAdminContext
        authProvider={{
          login: () => Promise.resolve(),
          logout: () => Promise.resolve(),
          checkAuth: () => Promise.resolve(),
          checkError: () => Promise.resolve(),
          getPermissions: () => Promise.resolve(),
          ...authProvider,
        }}
        i18nProvider={testI18nProvider}
        store={memoryStore()}
      >
        <Routes>
          <Route path={OAuthConsentPage.path} element={<OAuthConsentPage />} />
          <Route path="/login" element={<LoginSpy />} />
        </Routes>
      </CoreAdminContext>
    </TestMemoryRouter>,
  );

describe("OAuthConsentPage", () => {
  afterEach(() => {
    history.replaceState(null, "", location.pathname + location.search);
  });

  it("shows the requesting client and the access it gets", async () => {
    const screen = await renderConsentPage({
      getAuthorizationDetails: () =>
        Promise.resolve({ data: authorizationDetails, error: null }),
    });

    await expect.element(screen.getByText("Claude Code")).toBeVisible();
    await expect
      .element(screen.getByText(/read and modify your data/))
      .toBeVisible();
  });

  it("sends anonymous users to the login page, then back to the consent page", async () => {
    const screen = await renderConsentPage({
      checkAuth: () => Promise.reject(),
    });

    await expect
      .element(
        screen.getByText(
          "Login page, next: /oauth/consent?authorization_id=auth-123",
        ),
      )
      .toBeVisible();
  });

  it("logs out and sends users to the login page when the server revoked their session", async () => {
    const logout = vi.fn(() => Promise.resolve());
    const sessionMissing = Object.assign(new Error("Auth session missing!"), {
      name: "AuthSessionMissingError",
    });
    const screen = await renderConsentPage({
      logout,
      getAuthorizationDetails: () =>
        Promise.resolve({ data: null, error: sessionMissing }),
    });

    await expect
      .element(
        screen.getByText(
          "Login page, next: /oauth/consent?authorization_id=auth-123",
        ),
      )
      .toBeVisible();
    expect(logout).toHaveBeenCalled();
  });

  it("redirects straight to the client when the user already consented", async () => {
    // A same-document URL: assigning it only changes the hash, so the test
    // page stays loaded
    const redirectUrl = `${location.href.split("#")[0]}#consented`;
    await renderConsentPage({
      getAuthorizationDetails: () =>
        Promise.resolve({ data: { redirect_url: redirectUrl }, error: null }),
    });

    await expect.poll(() => location.hash).toBe("#consented");
  });

  it("shows the error returned by the authorization server", async () => {
    const screen = await renderConsentPage({
      getAuthorizationDetails: () =>
        Promise.resolve({
          data: null,
          error: new Error("authorization request cannot be processed"),
        }),
    });

    await expect
      .element(screen.getByText("authorization request cannot be processed"))
      .toBeVisible();
  });
});
