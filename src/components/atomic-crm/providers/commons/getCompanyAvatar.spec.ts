/**
 * @jest-environment node
 */

import type { Company } from "@/components/atomic-crm/types";
import { getCompanyAvatar } from "@/components/atomic-crm/providers/commons/getCompanyAvatar";

it("should return favicon URL if website url exist", async () => {
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
