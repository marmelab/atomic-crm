import type { Company } from "../../types";
import { getFaviconUrl } from "./getFaviconUrl";

// Main function to get the avatar URL
export async function getCompanyAvatar(record: Partial<Company>): Promise<{
  src: string;
  title: string;
} | null> {
  // TODO: Step 1: Try to get image from LinkedIn.

  // Step 2: Fallback to the favicon from website domain
  const websiteDomain = record.website
    ?.replace(/^https?:\/\//, "")
    .split("/")[0];
  if (!websiteDomain) {
    return null;
  }
  return {
    src: await getFaviconUrl(websiteDomain),
    title: "Company favicon",
  };
}
