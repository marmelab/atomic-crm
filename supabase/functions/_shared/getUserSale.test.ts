import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("./supabaseAdmin.ts", () => ({
  supabaseAdmin: { from: mockFrom },
}));

const { getUserSale } = await import("./getUserSale.ts");

describe("getUserSale", () => {
  const fakeUser = { id: "user-123" } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it("returns data when query succeeds", async () => {
    const sale = { id: "sale-1", user_id: "user-123" };
    mockSingle.mockResolvedValue({ data: sale, error: null });

    const result = await getUserSale(fakeUser);
    expect(result).toEqual(sale);
  });

  it("returns null when user has no sale record", async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });

    const result = await getUserSale(fakeUser);
    expect(result).toBeNull();
  });

  it("throws when Supabase returns an error", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "relation does not exist" },
    });

    await expect(getUserSale(fakeUser)).rejects.toThrow(
      "getUserSale failed: relation does not exist",
    );
  });
});
