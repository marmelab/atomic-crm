import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import polyglotI18nProvider from "ra-i18n-polyglot";
import { mergeTranslations, useLocaleState } from "ra-core";
import englishMessages from "ra-language-english";
import { render } from "vitest-browser-react";

import { useTheme } from "@/components/admin/use-theme";
import { Layout } from "../layout/Layout";
import { englishCrmMessages } from "../providers/commons/englishCrmMessages";
import type { UserPreferences } from "../types";
import { StoryWrapper } from "@/test/StoryWrapper";
import { PREFERENCES_QUERY_KEY } from "./preferences";
import {
  resetPendingPreferenceWrites,
  usePersistPreference,
} from "./usePersistPreference";

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
  {
    writeLatency = 0,
    readLatency = 0,
  }: { writeLatency?: number; readLatency?: number } = {},
) => {
  let stored: UserPreferences = { ...initial };
  return {
    read: () => ({ ...stored }),
    getPreferences: async () => {
      const current = stored;
      if (readLatency > 0) {
        await new Promise((resolve) => setTimeout(resolve, readLatency));
      }
      return { ...current };
    },
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

const createFailingSave = () => {
  let rejectSave: (error: Error) => void = () => {};
  let resolveSave: (preferences: UserPreferences) => void = () => {};
  let calls = 0;
  return {
    updatePreferences: () =>
      new Promise<UserPreferences>((resolve, reject) => {
        calls += 1;
        resolveSave = resolve;
        rejectSave = reject;
      }),
    fail: () => rejectSave(new Error("Denied")),
    succeed: (preferences: UserPreferences) => resolveSave(preferences),
    calls: () => calls,
  };
};

const createHeldReads = (initial: UserPreferences) => {
  let reads = 0;
  let releaseRead: () => void = () => {};
  return {
    getPreferences: () => {
      reads += 1;
      if (reads === 1) return Promise.resolve({ ...initial });
      return new Promise<UserPreferences>((resolve) => {
        releaseRead = () => resolve({ ...initial });
      });
    },
    release: () => releaseRead(),
    reads: () => reads,
  };
};

const createHeldFirstRead = () => {
  let releaseRead: (preferences: UserPreferences) => void = () => {};
  const firstRead = new Promise<UserPreferences>((resolve) => {
    releaseRead = resolve;
  });
  return {
    getPreferences: () => firstRead.then((preferences) => ({ ...preferences })),
    release: (preferences: UserPreferences) => releaseRead(preferences),
  };
};

const createHeldIdentity = (isHeld: boolean) => {
  let releaseIdentity: () => void = () => {};
  const identityLoaded = isHeld
    ? new Promise<void>((resolve) => {
        releaseIdentity = resolve;
      })
    : Promise.resolve();
  return {
    authProvider: {
      getIdentity: async () => {
        await identityLoaded;
        return { id: 0, fullName: "Jane Doe" };
      },
    },
    release: () => releaseIdentity(),
  };
};

const pickTheme = async (
  screen: Awaited<ReturnType<typeof render>>,
  name: string,
) => {
  await screen.getByRole("button", { name: "Toggle theme" }).click();
  await screen.getByRole("menuitem", { name }).click();
};

const pickDarkThenSystem = async (
  screen: Awaited<ReturnType<typeof render>>,
) => {
  await pickTheme(screen, "Dark");
  await pickTheme(screen, "System");
  await expect.element(screen.getByText("theme: system")).toBeVisible();
};

const queryErrorToast = (screen: Awaited<ReturnType<typeof render>>) =>
  screen.getByText("Could not save your preferences", { exact: false }).query();

const Probe = () => {
  const { theme } = useTheme();
  const [locale] = useLocaleState();
  const persist = usePersistPreference();
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ queryKey: [PREFERENCES_QUERY_KEY] });

  return (
    <div>
      <p>{`theme: ${theme}`}</p>
      <p>{`locale: ${locale}`}</p>
      <p>{`fetching: ${fetching}`}</p>
      <button onClick={() => persist({ locale: "fr" })}>
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
      <button
        onClick={() =>
          queryClient.refetchQueries({ queryKey: [PREFERENCES_QUERY_KEY] })
        }
      >
        refetch preferences
      </button>
    </div>
  );
};

describe("preference persistence", () => {
  beforeEach(() => {
    resetPendingPreferenceWrites();
  });

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

  it("is not overwritten by a read that was already in flight", async () => {
    const server = createFakeServer(
      { theme: "dark", locale: "en" },
      { readLatency: 400 },
    );
    const screen = await render(
      <StoryWrapper dataProvider={server} layout={Layout}>
        <Probe />
      </StoryWrapper>,
    );

    await screen.getByRole("button", { name: "Toggle theme" }).click();
    await screen.getByRole("menuitem", { name: "Light" }).click();

    await vi.waitFor(() => expect(server.read().theme).toBe("light"));
    await new Promise((resolve) => setTimeout(resolve, 600));
    await expect.element(screen.getByText("theme: light")).toBeVisible();
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

  it("keeps both changes on screen while the second of two back to back saves is pending", async () => {
    const server = createFakeServer({ theme: "dark", locale: "en" });
    const save = createFailingSave();
    const screen = await render(
      <StoryWrapper
        i18nProvider={createTwoLocalesI18nProvider()}
        dataProvider={{
          getPreferences: server.getPreferences,
          updatePreferences: (patch: Partial<UserPreferences>) =>
            save.calls() === 0 && patch.theme !== undefined
              ? server.updatePreferences(patch)
              : save.updatePreferences(),
        }}
        layout={Layout}
      >
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("locale: en")).toBeVisible();

    await screen.getByRole("button", { name: "change both at once" }).click();
    await vi.waitFor(() => expect(save.calls()).toBe(1));
    await new Promise((resolve) => setTimeout(resolve, 300));

    await expect.element(screen.getByText("theme: light")).toBeVisible();
    await expect.element(screen.getByText("locale: fr")).toBeVisible();
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

  it("reverts the theme when the first save of a user without stored preferences fails", async () => {
    const save = createFailingSave();
    const screen = await render(
      <StoryWrapper
        dataProvider={{
          getPreferences: createFakeServer({}).getPreferences,
          updatePreferences: save.updatePreferences,
        }}
        layout={Layout}
      >
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("theme: system")).toBeVisible();

    await screen.getByRole("button", { name: "Toggle theme" }).click();
    await screen.getByRole("menuitem", { name: "Dark" }).click();
    await expect.element(screen.getByText("theme: dark")).toBeVisible();
    save.fail();

    await expect
      .element(
        screen.getByText("Could not save your preferences", { exact: false }),
      )
      .toBeVisible();
    await expect.element(screen.getByText("theme: system")).toBeVisible();
  });

  it("keeps the newer theme without warning when an older save fails", async () => {
    const save = createFailingSave();
    const screen = await render(
      <StoryWrapper
        dataProvider={{
          getPreferences: createFakeServer({ theme: "light" }).getPreferences,
          updatePreferences: save.updatePreferences,
        }}
        layout={Layout}
      >
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("theme: light")).toBeVisible();

    await pickDarkThenSystem(screen);
    save.fail();
    await vi.waitFor(() => expect(save.calls()).toBe(2));
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect.element(screen.getByText("theme: system")).toBeVisible();
    expect(queryErrorToast(screen)).toBeNull();
    save.succeed({ theme: "system" });
    await new Promise((resolve) => setTimeout(resolve, 300));

    await expect.element(screen.getByText("theme: system")).toBeVisible();
    expect(queryErrorToast(screen)).toBeNull();
  });

  it("goes back to the stored theme when two quick changes both fail", async () => {
    const save = createFailingSave();
    const screen = await render(
      <StoryWrapper
        dataProvider={{
          getPreferences: createFakeServer({ theme: "light" }).getPreferences,
          updatePreferences: save.updatePreferences,
        }}
        layout={Layout}
      >
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("theme: light")).toBeVisible();

    await pickDarkThenSystem(screen);
    save.fail();
    await vi.waitFor(() => expect(save.calls()).toBe(2));
    await new Promise((resolve) => setTimeout(resolve, 300));
    await expect.element(screen.getByText("theme: system")).toBeVisible();
    expect(queryErrorToast(screen)).toBeNull();
    save.fail();

    await expect.element(screen.getByText("theme: light")).toBeVisible();
    await expect
      .element(
        screen.getByText("Could not save your preferences", { exact: false }),
      )
      .toBeVisible();
  });

  it("keeps the new theme when a refetch during the save returns the old one", async () => {
    const reads = createHeldReads({ theme: "dark" });
    const save = createFailingSave();
    const screen = await render(
      <StoryWrapper
        dataProvider={{
          getPreferences: reads.getPreferences,
          updatePreferences: save.updatePreferences,
        }}
        layout={Layout}
      >
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("theme: dark")).toBeVisible();

    await screen.getByRole("button", { name: "Toggle theme" }).click();
    await screen.getByRole("menuitem", { name: "Light" }).click();
    await vi.waitFor(() => expect(save.calls()).toBe(1));
    await screen.getByRole("button", { name: "refetch preferences" }).click();
    await vi.waitFor(() => expect(reads.reads()).toBe(2));
    reads.release();
    await new Promise((resolve) => setTimeout(resolve, 300));

    await expect.element(screen.getByText("theme: light")).toBeVisible();
  });

  it("reverts the locale when its save fails", async () => {
    const save = createFailingSave();
    const screen = await render(
      <StoryWrapper
        i18nProvider={createTwoLocalesI18nProvider()}
        dataProvider={{
          getPreferences: createFakeServer({}).getPreferences,
          updatePreferences: save.updatePreferences,
        }}
        layout={Layout}
      >
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("locale: en")).toBeVisible();

    await screen.getByRole("button", { name: "set french locale" }).click();
    await expect.element(screen.getByText("locale: fr")).toBeVisible();
    save.fail();

    await expect.element(screen.getByText("locale: en")).toBeVisible();
  });

  it("reverts the locale to the displayed one when the stored locale is not offered", async () => {
    const save = createFailingSave();
    const screen = await render(
      <StoryWrapper
        i18nProvider={createTwoLocalesI18nProvider()}
        dataProvider={{
          getPreferences: createFakeServer({ locale: "de" }).getPreferences,
          updatePreferences: save.updatePreferences,
        }}
        layout={Layout}
      >
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("locale: en")).toBeVisible();

    await screen.getByRole("button", { name: "set french locale" }).click();
    await expect.element(screen.getByText("locale: fr")).toBeVisible();
    save.fail();

    await expect.element(screen.getByText("locale: en")).toBeVisible();
  });

  it.each([
    {
      outcome: "fails",
      stored: { theme: "dark" as const, locale: "fr" },
      settle: (save: ReturnType<typeof createFailingSave>) => save.fail(),
      expectedTheme: "dark",
      identity: "before",
    },
    {
      outcome: "succeeds with the same preferences",
      stored: { theme: "light" as const, locale: "fr" },
      settle: (save: ReturnType<typeof createFailingSave>) =>
        save.succeed({ theme: "light", locale: "fr" }),
      expectedTheme: "light",
      identity: "before",
    },
  ])(
    "applies the stored locale read during a theme save, made $identity the identity loaded, that then $outcome",
    async ({ stored, settle, expectedTheme, identity: loaded }) => {
      const identity = createHeldIdentity(loaded === "after");
      const reads = createHeldFirstRead();
      const save = createFailingSave();
      const screen = await render(
        <StoryWrapper
          i18nProvider={createTwoLocalesI18nProvider()}
          authProvider={identity.authProvider}
          dataProvider={{
            getPreferences: reads.getPreferences,
            updatePreferences: save.updatePreferences,
          }}
          layout={Layout}
        >
          <Probe />
        </StoryWrapper>,
      );
      await expect.element(screen.getByText("theme: system")).toBeVisible();

      await pickTheme(screen, "Light");
      await vi.waitFor(() => expect(save.calls()).toBe(1));
      identity.release();
      await expect.element(screen.getByText("fetching: 1")).toBeVisible();
      reads.release(stored);
      await expect.element(screen.getByText("fetching: 0")).toBeVisible();
      settle(save);

      await expect.element(screen.getByText("locale: fr")).toBeVisible();
      await expect
        .element(screen.getByText(`theme: ${expectedTheme}`))
        .toBeVisible();
    },
  );

  it("applies the locale confirmed by a successful save when the next save fails", async () => {
    const save = createFailingSave();
    const screen = await render(
      <StoryWrapper
        i18nProvider={createTwoLocalesI18nProvider()}
        dataProvider={{
          getPreferences: createFakeServer({ theme: "light", locale: "en" })
            .getPreferences,
          updatePreferences: save.updatePreferences,
        }}
        layout={Layout}
      >
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("theme: light")).toBeVisible();

    await pickDarkThenSystem(screen);
    save.succeed({ theme: "dark", locale: "fr" });
    await vi.waitFor(() => expect(save.calls()).toBe(2));
    save.fail();

    await expect.element(screen.getByText("theme: dark")).toBeVisible();
    await expect.element(screen.getByText("locale: fr")).toBeVisible();
  });

  it("reverts only the failed theme while a newer locale save is pending", async () => {
    const save = createFailingSave();
    const screen = await render(
      <StoryWrapper
        i18nProvider={createTwoLocalesI18nProvider()}
        dataProvider={{
          getPreferences: createFakeServer({ theme: "dark", locale: "en" })
            .getPreferences,
          updatePreferences: save.updatePreferences,
        }}
        layout={Layout}
      >
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("theme: dark")).toBeVisible();

    await screen.getByRole("button", { name: "Toggle theme" }).click();
    await screen.getByRole("menuitem", { name: "Light" }).click();
    await screen.getByRole("button", { name: "set french locale" }).click();
    await vi.waitFor(() => expect(save.calls()).toBe(1));
    save.fail();

    await expect.element(screen.getByText("theme: dark")).toBeVisible();
    await expect.element(screen.getByText("locale: fr")).toBeVisible();
  });

  it("applies the stored preferences once a save made before the identity loaded succeeds", async () => {
    const server = createFakeServer({ theme: "dark", locale: "en" });
    let releaseIdentity: () => void = () => {};
    const identityLoaded = new Promise<void>((resolve) => {
      releaseIdentity = resolve;
    });
    const screen = await render(
      <StoryWrapper
        i18nProvider={createTwoLocalesI18nProvider()}
        authProvider={{
          getIdentity: async () => {
            await identityLoaded;
            return { id: 0, fullName: "Jane Doe" };
          },
        }}
        dataProvider={{
          getPreferences: server.getPreferences,
          updatePreferences: server.updatePreferences,
        }}
        layout={Layout}
      >
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("theme: system")).toBeVisible();

    await screen.getByRole("button", { name: "set french locale" }).click();
    await vi.waitFor(() => expect(server.read().locale).toBe("fr"));
    releaseIdentity();

    await expect.element(screen.getByText("theme: dark")).toBeVisible();
    await expect.element(screen.getByText("locale: fr")).toBeVisible();
  });

  it("does not revert or warn when a save started before a logout fails", async () => {
    const save = createFailingSave();
    const screen = await render(
      <StoryWrapper
        dataProvider={{
          getPreferences: createFakeServer({ theme: "dark" }).getPreferences,
          updatePreferences: save.updatePreferences,
        }}
        layout={Layout}
      >
        <Probe />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("theme: dark")).toBeVisible();

    await screen.getByRole("button", { name: "Toggle theme" }).click();
    await screen.getByRole("menuitem", { name: "Light" }).click();
    await expect.element(screen.getByText("theme: light")).toBeVisible();
    resetPendingPreferenceWrites();
    save.fail();
    await new Promise((resolve) => setTimeout(resolve, 300));

    await expect.element(screen.getByText("theme: light")).toBeVisible();
    expect(
      screen
        .getByText("Could not save your preferences", { exact: false })
        .query(),
    ).toBeNull();
  });
});
