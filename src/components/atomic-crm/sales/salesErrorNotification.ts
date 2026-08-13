export type SalesErrorNotification = {
  message: string;
  args: Record<string, string>;
};

const MESSAGE_BY_CODE: Record<string, string> = {
  email_taken: "crm.profile.email_taken",
  secondary_email_taken: "crm.profile.secondary_email_taken",
  invalid_secondary_email: "crm.profile.secondary_email_invalid",
};

export const getSalesErrorNotification = (
  error: unknown,
  fallbackMessage = "crm.profile.update_error",
): SalesErrorNotification => {
  const { code, email } = (error ?? {}) as { code?: string; email?: string };
  const message = code ? MESSAGE_BY_CODE[code] : undefined;

  return {
    message: message ?? fallbackMessage,
    args: { email: email ?? "" },
  };
};
