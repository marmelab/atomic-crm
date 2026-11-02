// For more info, see:
// https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format

import storybook from "eslint-plugin-storybook";

import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Global ignored files and directories
  {
    ignores: [
      "dist",
      "node_modules",
      "build",
      "lib",
      "esm",
      "prism.js",
      "packages/create-react-admin/templates/**",
      ".github/**",
      ".vitest/**",
      "**/.vitest/**",
    ],
  },

  // Main TypeScript and JavaScript configuration
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx,mjs}"],
    ignores: ["**/node_modules/**", "**/dist/**", "**/.astro/**"],

    languageOptions: {
      ecmaVersion: 2020,
    },

    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },

    rules: {
      ...reactHooks.configs.recommended.rules,

      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],

      "no-console": ["error", { allow: ["warn", "error"] }],

      "@typescript-eslint/no-explicit-any": "off",

      "@typescript-eslint/consistent-type-imports": "warn",
    },
  },

  // Browser globals for React components
  {
    files: ["**/*.{ts,tsx}"],

    languageOptions: {
      globals: globals.browser,
    },
  },

  // Node scripts and Claude Code hooks
  {
    files: ["**/*.mjs"],

    languageOptions: {
      globals: globals.node,
    },

    rules: {
      "no-undef": "error",
    },
  },

  // Strict rules for admin, hooks and library files
  {
    files: [
      "src/components/admin/*.{ts,tsx}",
      "src/hooks/*.{ts,tsx}",
      "src/lib/*.{ts,tsx}",
    ],

    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },

  // UI component exceptions
  {
    files: ["src/components/ui/*.{ts,tsx}"],

    rules: {
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },

  // Storybook recommended rules
  storybook.configs["flat/recommended"],
);
