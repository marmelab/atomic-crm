import { afterEach, describe, expect, it } from "vitest";

import {
  crmModules,
  getAiResourceModules,
  getDesktopHeaderModules,
  getEnabledModules,
  getMobileBottomBarModules,
  getModuleByResource,
} from "./moduleRegistry";

afterEach(() => {
  for (const module of crmModules) {
    if ("enabled" in module) {
      delete module.enabled;
    }
  }
});

describe("moduleRegistry", () => {
  it("returns enabled modules and keeps headless modules out of header navigation", () => {
    expect(getEnabledModules()).toHaveLength(13);

    const desktopHeaderResources = getDesktopHeaderModules().map(
      (module) => module.resource,
    );

    expect(desktopHeaderResources).toEqual([
      "clients",
      "contacts",
      "projects",
      "services",
      "quotes",
      "payments",
      "expenses",
      "client_tasks",
    ]);

    expect(desktopHeaderResources).not.toContain("client_notes");
    expect(desktopHeaderResources).not.toContain("project_contacts");
    expect(desktopHeaderResources).not.toContain("sales");
    expect(desktopHeaderResources).not.toContain("tags");
    expect(desktopHeaderResources).not.toContain("invoicing");
  });

  it("returns mobile bottom modules and AI resources from the registry", () => {
    expect(
      getMobileBottomBarModules().map((module) => module.resource),
    ).toEqual(["clients", "client_tasks"]);

    const aiResources = getAiResourceModules();
    expect(aiResources.every((module) => Boolean(module.ai))).toBe(true);
    expect(aiResources.some((module) => module.resource === "invoicing")).toBe(
      true,
    );

    expect(getModuleByResource("clients")?.label).toBe("Clienti");
  });

  it("excludes disabled modules from helper outputs", () => {
    const contacts = getModuleByResource("contacts");
    expect(contacts).toBeTruthy();

    if (!contacts) {
      return;
    }

    contacts.enabled = false;

    expect(
      getEnabledModules().some((module) => module.resource === "contacts"),
    ).toBe(false);
    expect(
      getDesktopHeaderModules().some(
        (module) => module.resource === "contacts",
      ),
    ).toBe(false);
    expect(
      getAiResourceModules().some((module) => module.resource === "contacts"),
    ).toBe(false);
  });
});
