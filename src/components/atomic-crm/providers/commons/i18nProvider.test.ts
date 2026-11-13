import { afterEach, describe, expect, it, vi } from "vitest";
import {
  businessLocale,
  getInitialLocale,
  i18nProvider,
  toSupportedLocale,
} from "./i18nProvider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("i18nProvider", () => {
  it("offers Ukrainian and English", () => {
    expect(i18nProvider.getLocales?.()).toEqual([
      { locale: "uk", name: "Українська" },
      { locale: "en", name: "English" },
    ]);
  });

  it("translates the CRM into Ukrainian", async () => {
    await i18nProvider.changeLocale("uk");

    expect(i18nProvider.translate("crm.language")).toBe("Мова");
    expect(i18nProvider.translate("crm.setup.create")).toBe("Створити бізнес");
    expect(i18nProvider.translate("ra.action.save")).toBe("Зберегти");
  });

  it("uses the three Ukrainian plural forms", async () => {
    await i18nProvider.changeLocale("uk");
    const contacts = (n: number) =>
      i18nProvider.translate("resources.companies.nb_contacts", {
        smart_count: n,
      });

    expect(contacts(1)).toBe("1 контакт");
    expect(contacts(3)).toBe("3 контакти");
    expect(contacts(5)).toBe("5 контактів");
    expect(contacts(21)).toBe("21 контакт");
  });

  it("keeps English for English", async () => {
    await i18nProvider.changeLocale("en");

    expect(i18nProvider.translate("crm.language")).toBe("Language");
    expect(i18nProvider.translate("ra-supabase.auth.password_reset")).toBe(
      "Check your emails for a Reset Password message.",
    );
  });

  it("starts in Ukrainian unless the browser asks for English", () => {
    vi.stubGlobal("navigator", { language: "uk-UA", languages: ["uk-UA"] });
    expect(getInitialLocale()).toBe("uk");

    vi.stubGlobal("navigator", { language: "en-US", languages: ["en-US"] });
    expect(getInitialLocale()).toBe("en");

    vi.stubGlobal("navigator", { language: "pl-PL", languages: ["pl-PL"] });
    expect(getInitialLocale()).toBe("uk");
  });

  it("speaks Ukrainian in a Ukrainian business, English elsewhere", () => {
    expect(businessLocale("uk")).toBe("uk");
    expect(businessLocale("pl")).toBe("en");
  });

  it("maps a business language to a supported interface language", () => {
    expect(toSupportedLocale("uk")).toBe("uk");
    expect(toSupportedLocale("en")).toBe("en");
    expect(toSupportedLocale(null)).toBe("uk");
  });
});
