import { Lock } from "lucide-react";
import { Translate } from "ra-core";

/**
 * Page displayed when the current user doesn't have the permissions to access a page.
 *
 * Used by default by `<Admin accessDenied>`, and can be passed to `<CanAccess accessDenied>`.
 */
export const AccessDenied = () => (
  <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-2 text-center">
    <Lock className="h-16 w-16 text-muted-foreground" />
    <h1 className="text-2xl font-semibold">
      <Translate i18nKey="ra.page.access_denied" />
    </h1>
    <p className="max-w-xl text-muted-foreground">
      <Translate i18nKey="ra.message.access_denied" />
    </p>
  </div>
);
