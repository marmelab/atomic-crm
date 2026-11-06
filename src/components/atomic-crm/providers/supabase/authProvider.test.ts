import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAuthProvider } from "./authProvider";
import { getDataProvider } from "./dataProvider";

const { getSession, getUser, from, single, invoke } = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  single: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({
    auth: { getSession, getUser },
    from,
    functions: { invoke },
  }),
}));

vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
vi.stubEnv("VITE_SB_PUBLISHABLE_KEY", "test-key");

const originalSale = {
  id: 1,
  first_name: "Jane",
  last_name: "Doe",
  avatar: { src: "https://example.com/old-avatar.png" },
  administrator: true,
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  getSession.mockResolvedValue({
    data: { session: { user: { id: "user-1" } } },
    error: null,
  });
  from.mockReturnValue({ select: () => ({ match: () => ({ single }) }) });
  single.mockResolvedValue({ data: originalSale, error: null });
});

describe("profile identity cache", () => {
  it("refreshes the avatar and name after a successful profile update", async () => {
    const authProvider = getAuthProvider();
    expect(await authProvider.getIdentity!()).toMatchObject({
      fullName: "Jane Doe",
      avatar: originalSale.avatar.src,
    });
    const updatedSale = {
      ...originalSale,
      first_name: "Janet",
      avatar: { src: "https://example.com/new-avatar.png" },
    };
    single.mockResolvedValue({ data: updatedSale, error: null });
    invoke.mockResolvedValue({ data: { data: updatedSale }, error: null });

    await getDataProvider().salesUpdate(1, {
      first_name: updatedSale.first_name,
      avatar: updatedSale.avatar.src,
    });

    expect(await authProvider.getIdentity!()).toMatchObject({
      fullName: "Janet Doe",
      avatar: updatedSale.avatar.src,
    });
    expect(single).toHaveBeenCalledTimes(2);
  });

  it("removes the avatar from the refreshed identity", async () => {
    const authProvider = getAuthProvider();
    await authProvider.getIdentity!();
    const updatedSale = { ...originalSale, avatar: null };
    single.mockResolvedValue({ data: updatedSale, error: null });
    invoke.mockResolvedValue({ data: { data: updatedSale }, error: null });

    await getDataProvider().salesUpdate(1, {});

    expect(await authProvider.getIdentity!()).toMatchObject({
      fullName: "Jane Doe",
      avatar: undefined,
    });
  });

  it("keeps the cached identity when the profile update fails", async () => {
    const authProvider = getAuthProvider();
    const identity = await authProvider.getIdentity!();
    invoke.mockResolvedValue({ data: null, error: new Error("Save failed") });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(getDataProvider().salesUpdate(1, {})).rejects.toThrow();
      expect(await authProvider.getIdentity!()).toEqual(identity);
      expect(single).toHaveBeenCalledTimes(1);
    } finally {
      errorLog.mockRestore();
    }
  });
});
