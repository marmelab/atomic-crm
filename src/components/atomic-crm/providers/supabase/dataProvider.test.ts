import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDataProvider } from "./dataProvider";

const rpc = vi.fn();
const upload = vi.fn();

vi.mock("./supabase", () => ({
  getSupabaseClient: () => ({
    rpc,
    auth: { getSession: async () => ({ data: { session: null } }) },
    storage: {
      from: () => ({
        upload,
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `http://localhost:54321/storage/${path}` },
        }),
      }),
    },
  }),
}));

// Hoisted: config is read once, when the imports above load.
vi.hoisted(() => {
  window._atomicCrmConfig = {
    supabaseUrl: "http://localhost:54321",
    supabasePublishableKey: "test-key",
  };
});

describe("globalSearch", () => {
  it("rejects with the HTTP status so an expired session logs out", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST303", message: "JWT expired" },
      status: 401,
    });

    await expect(
      getDataProvider().globalSearch("acme", ["companies"], 10),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe("contact avatar", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    upload.mockReset().mockResolvedValue({ error: null });
    fetchMock.mockReset().mockImplementation(
      async () =>
        new Response(JSON.stringify([{ id: 1 }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return () => vi.unstubAllGlobals();
  });

  // Body of the request that saves the contact through the REST API
  const savedContact = () => {
    const call = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/rest/v1/contacts"),
    );
    return JSON.parse(call![1].body);
  };

  const pickedPicture = () => ({
    src: "data:image/png;base64,iVBORw0KGgo=",
    title: "ada.png",
    rawFile: new File(["picture"], "ada.png", { type: "image/png" }),
  });

  it("stores a picture picked on creation and saves its public URL", async () => {
    await getDataProvider().create("contacts", {
      data: { first_name: "Ada", avatar: pickedPicture() },
    });

    expect(upload).toHaveBeenCalledTimes(1);
    const [path] = upload.mock.calls[0];
    expect(savedContact().avatar).toMatchObject({
      src: `http://localhost:54321/storage/${path}`,
      path,
      title: "ada.png",
    });
  });

  it("stores a picture picked on update and saves its public URL", async () => {
    await getDataProvider().update("contacts", {
      id: 1,
      data: { id: 1, avatar: pickedPicture() },
      previousData: { id: 1 },
    });

    expect(upload).toHaveBeenCalledTimes(1);
    const [path] = upload.mock.calls[0];
    expect(savedContact().avatar.src).toBe(
      `http://localhost:54321/storage/${path}`,
    );
  });

  it("keeps an automatically found avatar URL as is", async () => {
    const avatar = { src: "https://www.gravatar.com/avatar/abc?d=404" };

    await getDataProvider().update("contacts", {
      id: 1,
      data: { id: 1, avatar },
      previousData: { id: 1 },
    });

    expect(upload).not.toHaveBeenCalled();
    expect(savedContact().avatar).toEqual(avatar);
  });
});
