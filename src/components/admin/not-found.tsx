import { History, SearchX } from "lucide-react";
import { Translate, useAuthenticated } from "ra-core";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/admin/loading";

/**
 * Fallback page displayed when no route matches the current URL.
 */
export const NotFound = () => {
  const { isPending } = useAuthenticated();
  if (isPending) {
    return <Loading />;
  }
  return (
    <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-2 text-center">
      <SearchX className="h-16 w-16 text-muted-foreground" />
      <h1 className="text-2xl font-semibold">
        <Translate i18nKey="ra.page.not_found" />
      </h1>
      <p className="max-w-xl text-muted-foreground">
        <Translate i18nKey="ra.message.not_found" />
      </p>
      <Button className="mt-3 cursor-pointer" onClick={goBack}>
        <History />
        <Translate i18nKey="ra.action.back" />
      </Button>
    </div>
  );
};

function goBack() {
  window.history.go(-1);
}
