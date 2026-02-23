import { useState, type MouseEvent, type ComponentProps } from "react";
import { useLogin, useNotify } from "ra-core";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export const SSOAuthButton = ({
  children,
  domain,
  redirect: redirectTo,
  ...props
}: SSOAuthButtonProps) => {
  const login = useLogin();
  const notify = useNotify();
  const [isPending, setIsPending] = useState(false);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setIsPending(true);
    login(
      { ssoDomain: domain },
      redirectTo ?? window.location.toString(),
    ).catch((error) => {
      setIsPending(false);
      // The authProvide always reject for OAuth login but there will be no error
      // if the call actually succeeds. This is to avoid react-admin redirecting
      // immediately to the provided redirect prop before users are redirected to
      // the OAuth provider.
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

export type SSOAuthButtonProps = {
  domain: string;
  redirect?: string;
} & ComponentProps<typeof Button>;
