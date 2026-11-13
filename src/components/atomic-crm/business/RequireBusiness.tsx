import { useQuery } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { useDataProvider, useLocaleState, useStoreContext } from "ra-core";
import { Navigate } from "react-router";

import { businessLocale } from "../providers/commons/i18nProvider";
import type { CrmDataProvider } from "../providers/types";
import { SetupPage } from "./SetupPage";

/**
 * Sends a user who has no business yet (a new account) to the setup wizard:
 * every screen of the CRM works inside a business.
 */
export const RequireBusiness = ({ children }: { children: ReactNode }) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { data: business, isPending } = useQuery({
    queryKey: ["businesses", "current-or-none"],
    queryFn: () => dataProvider.getCurrentBusiness(),
  });

  useBusinessLocale(business?.language);

  if (isPending) return null;
  if (!business) return <Navigate to={SetupPage.path} replace />;
  return <>{children}</>;
};

/**
 * Speaks the language of the business country until the person picks a
 * language in their profile (Polish has no translation yet: English).
 */
const useBusinessLocale = (language: string | null | undefined) => {
  const store = useStoreContext();
  const [locale, setLocale] = useLocaleState();
  useEffect(() => {
    if (!language || store.getItem("locale") !== undefined) return;
    const wanted = businessLocale(language);
    if (wanted !== locale) setLocale(wanted);
  }, [language, locale, setLocale, store]);
};
