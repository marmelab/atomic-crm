export const normalizeSecondaryEmails = (
  secondaryEmails: unknown,
): string[] => {
  if (!Array.isArray(secondaryEmails)) {
    return [];
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
