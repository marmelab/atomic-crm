const LINKEDIN_URL_REGEX = /^http(?:s)?:\/\/(?:www\.)?linkedin.com\//;

export const isLinkedinUrl = (url: string) => {
  if (!url) return;
  try {
    // Parse the URL to ensure it is valid
    const parsedUrl = new URL(url);
    if (!parsedUrl.href.match(LINKEDIN_URL_REGEX)) {
      return {
        message: "crm.validation.invalid_linkedin_url",
        args: { _: "URL must be from linkedin.com" },
      };
    }
  } catch {
    // If URL parsing fails, return false
    return {
      message: "crm.validation.invalid_url",
      args: { _: "Must be a valid URL" },
    };
  }
};
