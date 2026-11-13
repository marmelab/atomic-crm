import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAuthProvider } from "./authProvider";

const { signOut, select } = vi.hoisted(() => ({
  signOut: vi.fn(),
  select: vi.fn(),
}));

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({
    auth: { signOut },
    from: () => ({ select }),
  }),
}));

describe("Supabase session isolation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.removeItem("RaStore.auth.is_initialized");
    localStorage.removeItem("RaStore.auth.current_sale");
    signOut.mockResolvedValue({ error: null });
    select.mockResolvedValue({ data: [{ is_initialized: 0 }] });
  });

  it("logs out only the browser session and clears the identity cache", async () => {
    localStorage.setItem("RaStore.auth.is_initialized", "true");
    localStorage.setItem("RaStore.auth.current_sale", '{"id":1}');

    await getAuthProvider().logout({});

    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
    expect(localStorage.getItem("RaStore.auth.is_initialized")).toBeNull();
    expect(localStorage.getItem("RaStore.auth.current_sale")).toBeNull();
  });

  it("propagates logout errors", async () => {
    const error = new Error("Sign-out failed");
    signOut.mockResolvedValue({ error });

    await expect(getAuthProvider().logout({})).rejects.toBe(error);
    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
  });

  it("preserves other sessions when redirecting an uninitialized CRM to signup", async () => {
    await expect(getAuthProvider().checkAuth({})).rejects.toEqual({
      redirectTo: "/sign-up",
      message: false,
    });

    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
  });
});
