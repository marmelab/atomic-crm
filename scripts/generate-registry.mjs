#!/usr/bin/env node

import { globSync } from "glob";
import fs from "node:fs";
import path from "node:path";

const registryPath = "registry.json";
const basePath = "src";
const atomicCrmComponentsPath = path.join(basePath, "components", "atomic-crm");
const supabaseComponentsPath = path.join(basePath, "components", "supabase");
const hooksPath = path.join(basePath, "hooks");
const libPath = path.join(basePath, "lib");

const excludedHooks = [
  "filter-context.tsx",
  "saved-queries.tsx",
  "use-mobile.ts",
  "useSupportCreateSuggestion.tsx",
];

const excludedLibFiles = [
  "field.type.ts",
  "genericMemo.ts",
  "i18nProvider.ts",
  "sanitizeInputRestProps.ts",
  "utils.ts",
];

const testFilePattern = "**/*.{test,spec}.*";
const storyFilePattern = "**/*.stories.*";

const atomicCrmComponents = globSync(
  path.join(atomicCrmComponentsPath, "**", "*.ts*"),
  { ignore: [testFilePattern, storyFilePattern] },
);
const supabaseComponents = globSync(
  path.join(supabaseComponentsPath, "**", "*.ts*"),
  { ignore: [testFilePattern, storyFilePattern] },
);
const hooks = globSync(path.join(hooksPath, "**", "*.ts*")).filter((hook) => {
  return !excludedHooks.includes(path.basename(hook));
});
const libFiles = globSync(path.join(libPath, "**", "*.ts*")).filter((file) => {
  return !excludedLibFiles.includes(path.basename(file));
});

const registryContent = JSON.parse(fs.readFileSync(registryPath, "utf-8"));

const files = [
  ...atomicCrmComponents.map((path) => {
    return {
      path,
      type: "registry:component",
    };
  }),
  ...supabaseComponents.map((path) => {
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
  ...libFiles.map((path) => {
    return {
      path,
      type: "registry:lib",
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
