const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export const findTakenEmail = (
  otherSales: { email: string; secondary_emails: string[] | null }[],
  emails: string[],
): string | undefined => {
  const takenEmails = new Set(
    otherSales
      .flatMap((sale) => [sale.email, ...(sale.secondary_emails ?? [])])
      .map((email) => email.toLowerCase()),
  );
  return emails.find((email) => takenEmails.has(email));
};
