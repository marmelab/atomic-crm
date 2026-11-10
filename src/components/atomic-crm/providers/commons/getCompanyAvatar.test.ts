import { fetchWithTimeout } from "../../misc/fetchWithTimeout";
import type { Company } from "../../types";
import { getCompanyAvatar } from "./getCompanyAvatar";

vi.mock("../../misc/fetchWithTimeout", () => ({
  fetchWithTimeout: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
});

it("should return the favicon.ico of the website domain if it can be fetched", async () => {
  vi.mocked(fetchWithTimeout).mockResolvedValue({ ok: true } as Response);
  const website = "https://example.com/about";
  const record: Partial<Company> = { website };

  const avatarUrl = await getCompanyAvatar(record);
  expect(avatarUrl).toStrictEqual({
    src: "https://example.com/favicon.ico",
    title: "Company favicon",
  });
});

it("should fall back to favicon.show if the website has no favicon.ico", async () => {
  vi.mocked(fetchWithTimeout).mockResolvedValue({ ok: false } as Response);
  const website = "https://example.com";
  const record: Partial<Company> = { website };

  const avatarUrl = await getCompanyAvatar(record);
  expect(avatarUrl).toStrictEqual({
    src: "https://favicon.show/example.com",
    title: "Company favicon",
  });
});

it("should fall back to favicon.show if the favicon.ico request fails", async () => {
  vi.mocked(fetchWithTimeout).mockRejectedValue(
    new TypeError("Failed to fetch"),
  );
  const website = "https://example.com";
  const record: Partial<Company> = { website };

  const avatarUrl = await getCompanyAvatar(record);
  expect(avatarUrl).toStrictEqual({
    src: "https://favicon.show/example.com",
    title: "Company favicon",
  });
});

it("should return null if no website is provided", async () => {
  const record: Partial<Company> = {};

  const avatarUrl = await getCompanyAvatar(record);
  expect(avatarUrl).toBeNull();
});
