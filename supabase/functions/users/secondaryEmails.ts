const EMAIL_PATTERN = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

export const MAX_SECONDARY_EMAILS = 10;

export const normalizeSecondaryEmails = (
  secondaryEmails: unknown,
): string[] | undefined => {
  if (!Array.isArray(secondaryEmails)) {
    return undefined;
  }
  return [
    ...new Set(
      secondaryEmails
        .filter((email): email is string => typeof email === "string")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
};

export const findInvalidEmail = (emails: string[]): string | undefined =>
  emails.find((email) => !EMAIL_PATTERN.test(email));
