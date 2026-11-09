/**
 * Deployment settings (Supabase instance, inbound email...), read at runtime
 * so that one build can be deployed to any environment.
 *
 * They come from window._atomicCrmConfig, set by the config.js file that
 * index.html loads before the app, written at deploy time by
 * scripts/renderRuntimeConfig.ts. When it isn't set (in dev, in a local build,
 * in a project that installed these components from the registry, or in unit
 * tests), they fall back to the VITE_* variables.
 */
export interface RuntimeConfig {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
  isDemo?: boolean;
  inboundEmail?: string;
  attachmentsBucket?: string;
  googleWorkplaceDomain?: string;
  disableEmailPasswordAuthentication?: boolean;
}

declare global {
  interface Window {
    _atomicCrmConfig?: RuntimeConfig;
  }
}

export const config: RuntimeConfig = window._atomicCrmConfig ?? {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabasePublishableKey: import.meta.env.VITE_SB_PUBLISHABLE_KEY,
  isDemo: import.meta.env.VITE_IS_DEMO === "true",
  inboundEmail: import.meta.env.VITE_INBOUND_EMAIL,
  attachmentsBucket: import.meta.env.VITE_ATTACHMENTS_BUCKET,
  googleWorkplaceDomain: import.meta.env.VITE_GOOGLE_WORKPLACE_DOMAIN,
  disableEmailPasswordAuthentication:
    import.meta.env.VITE_DISABLE_EMAIL_PASSWORD_AUTHENTICATION === "true",
};
