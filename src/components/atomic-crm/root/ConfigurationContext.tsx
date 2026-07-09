import { useMemo } from "react";
import { useStore } from "ra-core";

import type { DealStage, LabeledValue, NoteStatus } from "../types";
import { defaultConfiguration } from "./defaultConfiguration";

export const CONFIGURATION_STORE_KEY = "app.configuration";

/**
 * OAuth providers that can be enabled on the login/signup pages.
 * Each value must be a provider supported by Supabase's `signInWithOAuth`.
 */
export const OAUTH_PROVIDERS = [
  "google",
  "facebook",
  "github",
  "azure",
  "apple",
] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

/**
 * Parse a comma-separated list of OAuth providers (e.g. the
 * `VITE_ENABLED_OAUTH_PROVIDERS` env var) into a validated array.
 * Unknown or empty entries are discarded so the login UI never
 * renders a button for an unsupported provider.
 */
export const parseEnabledOAuthProviders = (
  value: string | undefined,
): OAuthProvider[] => {
  if (!value) {
    return [];
  }
  const known = new Set<string>(OAUTH_PROVIDERS);
  return value
    .split(",")
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider): provider is OAuthProvider => known.has(provider));
};

export interface ConfigurationContextValue {
  companySectors: LabeledValue[];
  currency: string;
  dealCategories: LabeledValue[];
  dealPipelineStatuses: string[];
  dealStages: DealStage[];
  noteStatuses: NoteStatus[];
  taskTypes: LabeledValue[];
  title: string;
  darkModeLogo: string;
  lightModeLogo: string;
  googleWorkplaceDomain?: string;
  disableEmailPasswordAuthentication?: boolean;
  enabledOAuthProviders?: OAuthProvider[];
}

export const useConfigurationContext = () => {
  const [config] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
    defaultConfiguration,
  );
  // Merge with defaults so that missing fields in stored config
  // fall back to default values (e.g. when new settings are added)
  return useMemo(() => ({ ...defaultConfiguration, ...config }), [config]);
};

export const useConfigurationUpdater = () => {
  const [, setConfig] = useStore<ConfigurationContextValue>(
    CONFIGURATION_STORE_KEY,
  );
  return setConfig;
};
