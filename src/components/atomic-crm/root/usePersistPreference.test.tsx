import polyglotI18nProvider from "ra-i18n-polyglot";
import { mergeTranslations, useLocaleState, useLocales } from "ra-core";
import englishMessages from "ra-language-english";
import { render } from "vitest-browser-react";

import { useTheme } from "@/components/admin/use-theme";
import { englishCrmMessages } from "../providers/commons/englishCrmMessages";
import type { UserPreferences } from "../types";
import { StoryWrapper } from "@/test/StoryWrapper";
import { usePersistPreference } from "./usePersistPreference";
import { usePreferencesLoader } from "./usePreferencesLoader";

const catalog = mergeTranslations(englishMessages, englishCrmMessages);

const twoLocalesI18nProvider = polyglotI18nProvider(
  () => catalog,
  "en",
  [
    { locale: "en", name: "English" },
    { locale: "fr", name: "Français" },
  ],
  { allowMissing: true },
);

const createFakeServer = (initial: UserPreferences) => {
  let stored: UserPreferences = { ...initial };
  return {
    read: () => ({ ...stored }),
    getPreferences: async () => ({ ...stored }),
    updatePreferences: async (patch: Partial<UserPreferences>) => {
      stored = { ...stored, ...patch };
      return { ...stored };
    },
  };
};

const Probe = () => {
  usePreferencesLoader();
  const { theme, setTheme } = useTheme();
  const [locale, setLocale] = useLocaleState();
  const locales = useLocales();
  const persist = usePersistPreference();

  return (
    <div>
      <p>{`theme: ${theme}`}</p>
      <p>{`locale: ${locale}`}</p>
      <p>{`locales: ${locales.length}`}</p>
      <button
        onClick={() => {
          setTheme("light");
          persist({ theme: "light" });
        }}
      >
        set light theme
      </button>
      <button
        onClick={() => {
          setLocale("fr");
          persist({ locale: "fr" });
        }}
      >
        set french locale
      </button>
    </div>
  );
};

describe("preference persistence", () => {
  it("applies the preferences stored on the server", async () => {
    const server = createFakeServer({ theme: "dark", locale: "en" });
    const screen = await render(
      <StoryWrapper dataProvider={server}>
        <Probe />
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("theme: dark")).toBeVisible();
  });

  it("keeps the new locale applied and stores it", async () => {
    const server = createFakeServer({ theme: "dark", locale: "en" });
    const screen = await render(
      <StoryWrapper i18nProvider={twoLocalesI18nProvider} dataProvider={server}>
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("locale: en")).toBeVisible();

    await screen.getByRole("button", { name: "set french locale" }).click();

    await expect.element(screen.getByText("locale: fr")).toBeVisible();
    await vi.waitFor(() => expect(server.read().locale).toBe("fr"));
  });

  it("stores a theme change without discarding the stored locale", async () => {
    const server = createFakeServer({ theme: "dark", locale: "fr" });
    const screen = await render(
      <StoryWrapper dataProvider={server}>
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("theme: dark")).toBeVisible();

    await screen.getByRole("button", { name: "set light theme" }).click();

    await expect.element(screen.getByText("theme: light")).toBeVisible();
    await vi.waitFor(() =>
      expect(server.read()).toEqual({ theme: "light", locale: "fr" }),
    );
  });

  it("reverts the change and warns the user when the server rejects it", async () => {
    const server = createFakeServer({ theme: "dark", locale: "en" });
    const screen = await render(
      <StoryWrapper
        dataProvider={{
          getPreferences: server.getPreferences,
          updatePreferences: () => Promise.reject(new Error("Denied")),
        }}
      >
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("theme: dark")).toBeVisible();

    await screen.getByRole("button", { name: "set light theme" }).click();

    await expect
      .element(
        screen.getByText("Could not save your preferences", { exact: false }),
      )
      .toBeVisible();
    await expect.element(screen.getByText("theme: dark")).toBeVisible();
    expect(server.read().theme).toBe("dark");
  });
});
