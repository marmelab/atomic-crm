import { useTranslate } from "ra-core";
import {
  useConfigurationContext,
  type OAuthProvider,
} from "@/components/atomic-crm/root/ConfigurationContext";
import { SocialLoginButton } from "./SocialLoginButton";

/**
 * i18n key + English fallback for each supported OAuth provider button.
 */
const OAUTH_PROVIDER_LABELS: Record<
  OAuthProvider,
  { i18nKey: string; defaultLabel: string }
> = {
  google: {
    i18nKey: "crm.auth.oauth_sign_in.google",
    defaultLabel: "Sign in with Google",
  },
  facebook: {
    i18nKey: "crm.auth.oauth_sign_in.facebook",
    defaultLabel: "Sign in with Facebook",
  },
  github: {
    i18nKey: "crm.auth.oauth_sign_in.github",
    defaultLabel: "Sign in with GitHub",
  },
  azure: {
    i18nKey: "crm.auth.oauth_sign_in.azure",
    defaultLabel: "Sign in with Microsoft",
  },
  apple: {
    i18nKey: "crm.auth.oauth_sign_in.apple",
    defaultLabel: "Sign in with Apple",
  },
};

/**
 * Renders a "Sign in with <provider>" button for every provider listed in
 * the `enabledOAuthProviders` configuration. Renders nothing when the list
 * is empty, so it is safe to drop into any auth page unconditionally.
 */
export const OAuthLoginButtons = ({ redirect }: { redirect?: string }) => {
  const { enabledOAuthProviders } = useConfigurationContext();
  const translate = useTranslate();

  if (!enabledOAuthProviders?.length) {
    return null;
  }

  return (
    <>
      {enabledOAuthProviders.map((provider) => {
        const { i18nKey, defaultLabel } = OAUTH_PROVIDER_LABELS[provider];
        return (
          <SocialLoginButton
            key={provider}
            className="w-full"
            provider={provider}
            redirect={redirect}
          >
            {translate(i18nKey, { _: defaultLabel })}
          </SocialLoginButton>
        );
      })}
    </>
  );
};
