export type SalesUpdateNotification = {
  message: string;
  args: Record<string, string>;
};

const MESSAGE_BY_CODE: Record<string, string> = {
  email_taken: "crm.profile.email_taken",
  secondary_email_taken: "crm.profile.secondary_email_taken",
  invalid_secondary_email: "crm.profile.secondary_email_invalid",
  invalid_secondary_emails_payload: "crm.profile.update_error",
};

export const getSalesUpdateNotification = (
  error: unknown,
): SalesUpdateNotification => {
  const { code, email } = (error ?? {}) as { code?: string; email?: string };
  const message = code ? MESSAGE_BY_CODE[code] : undefined;

  return {
    message: message ?? "crm.profile.update_error",
    args: { email: email ?? "" },
  };
};
