declare module "vitest/internal/browser" {
  interface BrowserCommands {
    setTimezone(timezoneId: string): Promise<void>;
  }
}
