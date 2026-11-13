import polyglotI18nProvider from "ra-i18n-polyglot";
import { mergeTranslations, useLocaleState } from "ra-core";
import englishMessages from "ra-language-english";
import { render } from "vitest-browser-react";

import { useTheme } from "@/components/admin/use-theme";
import { StoryWrapper } from "@/test/StoryWrapper";
import { Layout } from "../layout/Layout";
import { englishCrmMessages } from "../providers/commons/englishCrmMessages";
import type { UserPreferences } from "../types";

const catalog = mergeTranslations(englishMessages, englishCrmMessages);

const createTwoLocalesI18nProvider = () =>
  polyglotI18nProvider(
    () => catalog,
    "en",
    [
      { locale: "en", name: "English" },
      { locale: "fr", name: "Français" },
    ],
    { allowMissing: true },
  );

const createFakeServer = (
  initial: UserPreferences,
  { firstWriteLatency = 0 }: { firstWriteLatency?: number } = {},
) => {
  let stored: UserPreferences = { ...initial };
  let writes = 0;
  return {
    read: () => ({ ...stored }),
    writes: () => writes,
    getPreferences: async () => ({ ...stored }),
    updatePreferences: async (patch: Partial<UserPreferences>) => {
      writes += 1;
      const latency = writes === 1 ? firstWriteLatency : 0;
      await new Promise((resolve) => setTimeout(resolve, latency));
      stored = { ...stored, ...patch };
      return { ...stored };
    },
  };
};

const Probe = () => {
  const { theme } = useTheme();
  const [locale, setLocale] = useLocaleState();
  return (
    <div>
      <p>{`theme: ${theme}`}</p>
      <p>{`locale: ${locale}`}</p>
      <button onClick={() => setLocale("fr")}>set french locale</button>
    </div>
  );
};

const renderWithServer = (
  dataProvider: Pick<
    ReturnType<typeof createFakeServer>,
    "getPreferences" | "updatePreferences"
  >,
) =>
  render(
    <StoryWrapper
      i18nProvider={createTwoLocalesI18nProvider()}
      dataProvider={dataProvider}
      layout={Layout}
    >
      <Probe />
    </StoryWrapper>,
  );

const pickTheme = async (
  screen: Awaited<ReturnType<typeof render>>,
  name: string,
) => {
  await screen.getByRole("button", { name: "Toggle theme" }).click();
  await screen.getByRole("menuitem", { name }).click();
};

describe("usePreferencesSync", () => {
  it("applies the preferences stored on the server", async () => {
    const server = createFakeServer({ theme: "dark", locale: "fr" });

    const screen = await renderWithServer(server);

    await expect.element(screen.getByText("theme: dark")).toBeVisible();
    await expect.element(screen.getByText("locale: fr")).toBeVisible();
  });

  it("ignores a stored locale the app does not offer", async () => {
    const server = createFakeServer({ theme: "dark", locale: "de" });

    const screen = await renderWithServer(server);

    await expect.element(screen.getByText("theme: dark")).toBeVisible();
    await expect.element(screen.getByText("locale: en")).toBeVisible();
  });

  it("stores the theme picked from the header toggle", async () => {
    const server = createFakeServer({ theme: "dark", locale: "en" });
    const screen = await renderWithServer(server);
    await expect.element(screen.getByText("theme: dark")).toBeVisible();

    await pickTheme(screen, "Light");

    await expect.element(screen.getByText("theme: light")).toBeVisible();
    await vi.waitFor(() =>
      expect(server.read()).toEqual({ theme: "light", locale: "en" }),
    );
  });

  it("stores the locale changed through the locale state", async () => {
    const server = createFakeServer({ theme: "dark", locale: "en" });
    const screen = await renderWithServer(server);
    await expect.element(screen.getByText("theme: dark")).toBeVisible();

    await screen.getByRole("button", { name: "set french locale" }).click();

    await expect.element(screen.getByText("locale: fr")).toBeVisible();
    await vi.waitFor(() => expect(server.read().locale).toBe("fr"));
  });

  it("saves a locale change only once", async () => {
    const server = createFakeServer(
      { theme: "dark", locale: "en" },
      { firstWriteLatency: 300 },
    );
    const screen = await renderWithServer(server);
    await expect.element(screen.getByText("theme: dark")).toBeVisible();

    await screen.getByRole("button", { name: "set french locale" }).click();

    await vi.waitFor(() => expect(server.read().locale).toBe("fr"), {
      timeout: 2000,
    });
    expect(server.writes()).toBe(1);
  });

  it("saves a theme change only once", async () => {
    const server = createFakeServer(
      { theme: "dark", locale: "en" },
      { firstWriteLatency: 300 },
    );
    const screen = await renderWithServer(server);
    await expect.element(screen.getByText("theme: dark")).toBeVisible();

    await pickTheme(screen, "Light");

    await vi.waitFor(() => expect(server.read().theme).toBe("light"), {
      timeout: 2000,
    });
    expect(server.writes()).toBe(1);
  });

  it("stores the last of two changes when the first save is the slowest", async () => {
    const server = createFakeServer(
      { theme: "dark", locale: "en" },
      { firstWriteLatency: 300 },
    );
    const screen = await renderWithServer(server);
    await expect.element(screen.getByText("theme: dark")).toBeVisible();

    await pickTheme(screen, "Light");
    await pickTheme(screen, "System");

    await vi.waitFor(() => expect(server.read().theme).toBe("system"), {
      timeout: 2000,
    });
    await expect.element(screen.getByText("theme: system")).toBeVisible();
  });

  it("keeps the picked theme and warns the user when the save fails", async () => {
    const server = createFakeServer({ theme: "dark", locale: "en" });
    const screen = await renderWithServer({
      getPreferences: server.getPreferences,
      updatePreferences: () => Promise.reject(new Error("Denied")),
    });
    await expect.element(screen.getByText("theme: dark")).toBeVisible();

    await pickTheme(screen, "Light");

    await expect
      .element(
        screen.getByText("Could not save your preferences", { exact: false }),
      )
      .toBeVisible();
    await expect.element(screen.getByText("theme: light")).toBeVisible();
    expect(server.read().theme).toBe("dark");
  });
});
