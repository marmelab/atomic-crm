import { Link } from "react-router";
import { Translate, useHandleAuthCallback, useTranslate } from "ra-core";
import { CircleAlert, LockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/admin/loading";

/**
 * A standalone page to be used in a route called by external authentication services (e.g. OAuth)
 * after the user has been authenticated.
 *
 * Copy and adapt this component to implement your own login logic
 * (e.g. to show a different waiting screen, start onboarding procedures, etc.).
 *
 * @example
 *     import MyAuthCallbackPage from './MyAuthCallbackPage';
 *     const App = () => (
 *         <Admin authCallbackPage={MyAuthCallbackPage} authProvider={authProvider}>
 *             ...
 *         </Admin>
 *     );
 */
export const AuthCallback = () => {
  const { error } = useHandleAuthCallback();
  if (error) {
    return (
      <AuthError
        message={(error as Error) ? (error as Error).message : undefined}
      />
    );
  }
  return <Loading />;
};

export interface AuthErrorProps {
  className?: string;
  title?: string;
  message?: string;
}

export const AuthError = (props: AuthErrorProps) => {
  const {
    className,
    title = "ra.page.error",
    message = "ra.message.auth_error",
    ...rest
  } = props;

  const translate = useTranslate();
  return (
    <div
      className={cn(
        "flex flex-col justify-center items-center h-full",
        className,
      )}
      {...rest}
    >
      <h1 className="flex items-center text-3xl my-5 gap-3" role="alert">
        <CircleAlert className="w-2em h-2em" />
        <Translate i18nKey={title} />
      </h1>
      <p className="my-5">{translate(message, { _: message })}</p>
      <Button asChild>
        <Link to="/login">
          <LockIcon /> {translate("ra.auth.sign_in", { _: "Sign in" })}
        </Link>
      </Button>
    </div>
  );
};
