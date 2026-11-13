import { fetchWithTimeout } from "../../misc/fetchWithTimeout";

// Same strategy as the get_domain_favicon database function:
// try the favicon.ico of the domain first, then fall back to favicon.show
// (no favicon.ico, unreachable website, or request blocked by CORS).
export async function getFaviconUrl(domain: string): Promise<string> {
  const faviconUrl = `https://${domain}/favicon.ico`;
  try {
    const response = await fetchWithTimeout(faviconUrl);
    if (response.ok) {
      return faviconUrl;
    }
  } catch {
    // Fallback to favicon.show
  }
  return `https://favicon.show/${domain}`;
}
