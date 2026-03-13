import { afterEach, describe, expect, it, vi } from "vitest";
import { getInitialLocale, i18nProvider } from "./i18nProvider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("i18nProvider", () => {
  it("registers en, fr and es locales", () => {
    expect(i18nProvider.getLocales?.()).toEqual([
      { locale: "en", name: "English" },
      { locale: "fr", name: "Français" },
      { locale: "es", name: "Español" },
    ]);
  });

  it("translates the language key in french", async () => {
    await i18nProvider.changeLocale("fr");

    expect(i18nProvider.translate("crm.language")).toBe("Langue");
  });

  it("falls back to english for unknown locales", async () => {
    await i18nProvider.changeLocale("xx");

    expect(i18nProvider.translate("crm.language")).toBe("Language");
  });

  it("uses customized password reset overrides for en, fr and es", async () => {
    await i18nProvider.changeLocale("en");
    expect(i18nProvider.translate("ra-supabase.auth.password_reset")).toBe(
      "Check your emails for a Reset Password message.",
    );

    await i18nProvider.changeLocale("fr");
    expect(i18nProvider.translate("ra-supabase.auth.password_reset")).toBe(
      "Consultez vos emails pour trouver le message de reinitialisation du mot de passe.",
    );

    await i18nProvider.changeLocale("es");
    expect(i18nProvider.translate("ra-supabase.auth.password_reset")).toBe(
      "Revisa tu correo para encontrar el mensaje de restablecimiento de contraseña.",
    );
  });

  it("translates all ra-supabase keys for es", async () => {
    await i18nProvider.changeLocale("es");

    expect(i18nProvider.translate("ra-supabase.auth.forgot_password")).toBe(
      "¿Olvidaste tu contraseña?",
    );
    expect(
      i18nProvider.translate("ra-supabase.validation.password_mismatch"),
    ).toBe("Las contraseñas no coinciden");
    expect(
      i18nProvider.translate("ra-supabase.set_password.new_password"),
    ).toBe("Elige tu contraseña");
  });

  it("translates recently added fr crm keys", async () => {
    await i18nProvider.changeLocale("fr");

    expect(i18nProvider.translate("resources.deals.empty.title")).toBe(
      "Aucune affaire trouvée",
    );
  });

  it("translates CRM keys for es", async () => {
    await i18nProvider.changeLocale("es");

    expect(i18nProvider.translate("crm.language")).toBe("Idioma");
    expect(i18nProvider.translate("crm.auth.welcome_title")).toBe(
      "Bienvenido/a a Atomic CRM",
    );
    expect(
      i18nProvider.translate("resources.contacts.name", { smart_count: 2 }),
    ).toBe("Contactos");
    expect(
      i18nProvider.translate("resources.deals.name", { smart_count: 1 }),
    ).toBe("Oportunidad");
    expect(i18nProvider.translate("crm.settings.title")).toBe("Configuración");
    expect(i18nProvider.translate("crm.welcome.title")).toBe(
      "Tu kit de inicio CRM",
    );
    expect(i18nProvider.translate("crm.deals_chart.won")).toBe("Ganadas");
  });

  it("uses browser french locale when available", () => {
    vi.stubGlobal("navigator", {
      language: "fr-FR",
      languages: ["fr-FR", "en-US"],
    });

    expect(getInitialLocale()).toBe("fr");
  });

  it("uses browser spanish locale when available", () => {
    vi.stubGlobal("navigator", {
      language: "es-ES",
      languages: ["es-ES", "pt-BR"],
    });

    expect(getInitialLocale()).toBe("es");
  });
});
