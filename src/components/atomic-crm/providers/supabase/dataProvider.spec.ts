import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockBaseGetList = vi.fn();
const mockBaseGetOne = vi.fn();
const mockBaseDelete = vi.fn();
const mockBaseCreate = vi.fn();
const mockBaseUpdate = vi.fn();
const mockBaseGetMany = vi.fn();
const mockBaseGetManyReference = vi.fn();
const mockBaseUpdateMany = vi.fn();
const mockBaseDeleteMany = vi.fn();

const mockSupabaseDataProvider = vi.fn(() => ({
  getList: mockBaseGetList,
  getOne: mockBaseGetOne,
  getMany: mockBaseGetMany,
  getManyReference: mockBaseGetManyReference,
  create: mockBaseCreate,
  update: mockBaseUpdate,
  updateMany: mockBaseUpdateMany,
  delete: mockBaseDelete,
  deleteMany: mockBaseDeleteMany,
}));

const mockStorageRemove = vi.fn();
const mockStorageCreateSignedUrl = vi.fn();
const mockStorageUpload = vi.fn();
const mockStorageGetPublicUrl = vi.fn();

const mockStorageFrom = vi.fn(() => ({
  remove: mockStorageRemove,
  createSignedUrl: mockStorageCreateSignedUrl,
  upload: mockStorageUpload,
  getPublicUrl: mockStorageGetPublicUrl,
}));

const mockSupabase = {
  storage: {
    from: mockStorageFrom,
  },
  auth: {
    signUp: vi.fn(),
  },
  functions: {
    invoke: vi.fn(),
  },
};

const mockGetIsInitialized = vi.fn();
(mockGetIsInitialized as any)._is_initialized_cache = false;

vi.mock("ra-supabase-core", () => ({
  supabaseDataProvider: mockSupabaseDataProvider,
}));

vi.mock("./supabase", () => ({
  supabase: mockSupabase,
}));

vi.mock("./authProvider", () => ({
  getIsInitialized: mockGetIsInitialized,
}));

vi.mock("../commons/activity", () => ({
  getActivityLog: vi.fn(),
}));

describe("supabase dataProvider note attachment deletion", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    Object.assign(import.meta.env, {
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      VITE_SB_PUBLISHABLE_KEY: "test-key",
    });

    mockStorageRemove.mockResolvedValue({ error: null });
    mockBaseDelete.mockResolvedValue({ data: { id: 1 } });
    mockStorageGetPublicUrl.mockReturnValue({
      data: {
        publicUrl: "http://127.0.0.1:54321/storage/v1/object/public/attachments/file.txt",
      },
    });

    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deletes contact note attachment by path", async () => {
    const { dataProvider } = await import("./dataProvider");
    const previousData = {
      id: 1,
      attachments: [
        {
          title: "file.txt",
          src: "http://127.0.0.1:54321/storage/v1/object/public/attachments/file.txt",
          path: "file.txt",
        },
      ],
    };

    await dataProvider.delete("contact_notes", { id: 1, previousData } as any);

    expect(mockStorageFrom).toHaveBeenCalledWith("attachments");
    expect(mockStorageRemove).toHaveBeenCalledWith(["file.txt"]);
    expect(mockBaseDelete).toHaveBeenCalledWith("contact_notes", {
      id: 1,
      previousData,
    });
  });

  it("deletes deal note attachment using src when path is missing", async () => {
    const { dataProvider } = await import("./dataProvider");
    const attachmentSrc =
      "http://127.0.0.1:54321/storage/v1/object/public/attachments/folder/my%20report.txt?download=1";
    const previousData = {
      id: 2,
      attachments: [
        {
          title: "my report.txt",
          src: attachmentSrc,
        },
      ],
    };

    await dataProvider.delete("deal_notes", { id: 2, previousData } as any);

    expect(mockStorageRemove).toHaveBeenCalledWith([attachmentSrc]);
    expect(mockBaseDelete).toHaveBeenCalledWith("deal_notes", {
      id: 2,
      previousData,
    });
  });

  it("does not call storage remove when note has no attachments", async () => {
    const { dataProvider } = await import("./dataProvider");
    const previousData = {
      id: 3,
      attachments: [],
    };

    await dataProvider.delete("contact_notes", { id: 3, previousData } as any);

    expect(mockStorageRemove).not.toHaveBeenCalled();
    expect(mockBaseDelete).toHaveBeenCalledWith("contact_notes", {
      id: 3,
      previousData,
    });
  });

  it("throws and aborts note deletion when storage removal fails", async () => {
    const { dataProvider } = await import("./dataProvider");
    const previousData = {
      id: 4,
      attachments: [
        {
          title: "fail.txt",
          src: "http://127.0.0.1:54321/storage/v1/object/public/attachments/fail.txt",
          path: "fail.txt",
        },
      ],
    };

    mockStorageRemove.mockResolvedValueOnce({
      error: { message: "remove failed" },
    });

    await expect(
      dataProvider.delete("contact_notes", { id: 4, previousData } as any),
    ).rejects.toThrow("Failed to delete note attachments");

    expect(mockBaseDelete).not.toHaveBeenCalled();
  });
});
