import polyglotI18nProvider from "ra-i18n-polyglot";
import { mergeTranslations, useLocaleState } from "ra-core";
import englishMessages from "ra-language-english";
import { render } from "vitest-browser-react";

import { useTheme } from "@/components/admin/use-theme";
import { Layout } from "../layout/Layout";
import { englishCrmMessages } from "../providers/commons/englishCrmMessages";
import type { UserPreferences } from "../types";
import { StoryWrapper } from "@/test/StoryWrapper";
import { usePersistPreference } from "./usePersistPreference";

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
  { writeLatency = 0 }: { writeLatency?: number } = {},
) => {
  let stored: UserPreferences = { ...initial };
  return {
    read: () => ({ ...stored }),
    getPreferences: async () => ({ ...stored }),
    updatePreferences: async (patch: Partial<UserPreferences>) => {
      const current = stored;
      if (writeLatency > 0) {
        await new Promise((resolve) => setTimeout(resolve, writeLatency));
      }
      stored = { ...current, ...patch };
      return { ...stored };
    },
  };
};

const Probe = () => {
  const { theme } = useTheme();
  const [locale, setLocale] = useLocaleState();
  const persist = usePersistPreference();

  return (
    <div>
      <p>{`theme: ${theme}`}</p>
      <p>{`locale: ${locale}`}</p>
      <button
        onClick={() => {
          setLocale("fr");
          persist({ locale: "fr" });
        }}
      >
        set french locale
      </button>
      <button
        onClick={() => {
          persist({ theme: "light" });
          persist({ locale: "fr" });
        }}
      >
        change both at once
      </button>
    </div>
  );
};

describe("preference persistence", () => {
  it("applies the preferences stored on the server", async () => {
    const server = createFakeServer({ theme: "dark", locale: "en" });
    const screen = await render(
      <StoryWrapper dataProvider={server} layout={Layout}>
        <Probe />
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("theme: dark")).toBeVisible();
  });

  it("reaches the profile page from the header user menu", async () => {
    const server = createFakeServer({ theme: "dark", locale: "en" });
    const screen = await render(
      <StoryWrapper dataProvider={server} layout={Layout}>
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("theme: dark")).toBeVisible();

    await screen.getByRole("button", { name: "Profile" }).click();

    await expect
      .element(screen.getByRole("menuitem", { name: "Profile" }))
      .toBeVisible();
  });

  it("stores the theme picked from the header toggle", async () => {
    const server = createFakeServer({ theme: "dark", locale: "fr" });
    const screen = await render(
      <StoryWrapper dataProvider={server} layout={Layout}>
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("theme: dark")).toBeVisible();

    await screen.getByRole("button", { name: "Toggle theme" }).click();
    await screen.getByRole("menuitem", { name: "Light" }).click();

    await expect.element(screen.getByText("theme: light")).toBeVisible();
    await vi.waitFor(() =>
      expect(server.read()).toEqual({ theme: "light", locale: "fr" }),
    );
  });

  it("keeps the new locale applied and stores it", async () => {
    const server = createFakeServer({ theme: "dark", locale: "en" });
    const screen = await render(
      <StoryWrapper
        i18nProvider={createTwoLocalesI18nProvider()}
        dataProvider={server}
        layout={Layout}
      >
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("locale: en")).toBeVisible();

    await screen.getByRole("button", { name: "set french locale" }).click();

    await expect.element(screen.getByText("locale: fr")).toBeVisible();
    await vi.waitFor(() => expect(server.read().locale).toBe("fr"));
  });

  it("ignores a stored locale the app does not offer", async () => {
    const server = createFakeServer({ theme: "dark", locale: "de" });
    const screen = await render(
      <StoryWrapper
        i18nProvider={createTwoLocalesI18nProvider()}
        dataProvider={server}
        layout={Layout}
      >
        <Probe />
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("theme: dark")).toBeVisible();
    await expect.element(screen.getByText("locale: en")).toBeVisible();
  });

  it("does not lose one of two changes made back to back", async () => {
    const server = createFakeServer(
      { theme: "dark", locale: "en" },
      { writeLatency: 30 },
    );
    const screen = await render(
      <StoryWrapper dataProvider={server} layout={Layout}>
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("theme: dark")).toBeVisible();

    await screen.getByRole("button", { name: "change both at once" }).click();

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
        layout={Layout}
      >
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("theme: dark")).toBeVisible();

    await screen.getByRole("button", { name: "Toggle theme" }).click();
    await screen.getByRole("menuitem", { name: "Light" }).click();

    await expect
      .element(
        screen.getByText("Could not save your preferences", { exact: false }),
      )
      .toBeVisible();
    await expect.element(screen.getByText("theme: dark")).toBeVisible();
    expect(server.read().theme).toBe("dark");
  });
});
