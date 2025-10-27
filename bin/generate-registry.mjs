#!/usr/bin/env node

import { globSync } from "glob";
import fs from "node:fs";
import path from "node:path";

const registryPath = "registry.json";
const basePath = "src";
const componentsPath = path.join(basePath, "components", "atomic-crm");
const hooksPath = path.join(basePath, "hooks");

const excludedHooks = [
  "filter-context.tsx",
  "saved-queries.tsx",
  "use-mobile.ts",
  "useSupportCreateSuggestion.tsx",
];

const components = globSync(path.join(componentsPath, "**", "*.ts*"));
const hooks = globSync(path.join(hooksPath, "**", "*.ts*")).filter((hook) => {
  return !excludedHooks.includes(path.basename(hook));
});

const registryContent = JSON.parse(fs.readFileSync(registryPath, "utf-8"));

const files = [
  ...components.map((path) => {
    return {
      path,
      type: "registry:component",
    };
  }),
  ...hooks.map((path) => {
    return {
      path,
      type: "registry:hook",
    };
  }),
];

const newRegistryContent = {
  ...registryContent,
  items: registryContent.items.map((item) => {
    if (item.name === "atomic-crm") {
      return {
        ...item,
        files,
      };
    }

    return item;
  }),
};

fs.writeFileSync(
  registryPath,
  JSON.stringify(newRegistryContent, null, 2),
  "utf-8",
);
