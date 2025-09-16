export const getExpectedAuthorization = (
  webhookUser: string,
  webhookPassword: string,
) => `Basic ${btoa(`${webhookUser}:${webhookPassword}`)}`;
