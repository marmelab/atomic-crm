import { useState, type MouseEvent, type ComponentProps } from "react";
import { useLogin, useNotify, useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  useConfigurationContext,
  type OAuthProvider,
} from "@/components/atomic-crm/root/ConfigurationContext";

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

export type OAuthLoginButtonProps = {
  provider: OAuthProvider;
  redirect?: string;
} & ComponentProps<typeof Button>;

/**
 * A single "Sign in with <provider>" button that starts a Supabase OAuth
 * flow for one provider. Each button owns its own pending state, so it must
 * be its own component (hooks can't run inside the list's `.map`).
 */
export const OAuthLoginButton = ({
  children,
  provider,
  redirect: redirectTo,
  ...props
}: OAuthLoginButtonProps) => {
  const login = useLogin();
  const notify = useNotify();
  const [isPending, setIsPending] = useState(false);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsPending(true);
    login(
      { oauthProvider: provider },
      redirectTo ?? window.location.toString(),
    ).catch((error) => {
      setIsPending(false);
      // The authProvider always rejects for OAuth login but there will be no
      // error if the call actually succeeds. This is to avoid react-admin
      // redirecting immediately to the provided redirect prop before users
      // are redirected to the OAuth provider.
      if (error) {
        notify(
          typeof error === "string"
            ? error
            : typeof error === "undefined" || !error.message
              ? "ra.auth.sign_in_error"
              : error.message,
          {
            type: "error",
            messageArgs: {
              _:
                typeof error === "string"
                  ? error
                  : error && error.message
                    ? error.message
                    : undefined,
            },
          },
        );
      }
    });
  };

  return (
    <Button type="button" onClick={handleClick} disabled={isPending} {...props}>
      {children}
      {isPending ? (
        <Spinner
          className="text-primary-foreground size-4"
          data-icon="inline-start"
        />
      ) : null}
    </Button>
  );
};

/**
 * Renders an {@link OAuthLoginButton} for every provider listed in the
 * `enabledOAuthProviders` configuration. Renders nothing when the list is
 * empty, so it is safe to drop into any auth page unconditionally.
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
          <OAuthLoginButton
            key={provider}
            className="w-full"
            provider={provider}
            redirect={redirect}
          >
            {translate(i18nKey, { _: defaultLabel })}
          </OAuthLoginButton>
        );
      })}
    </>
  );
};
