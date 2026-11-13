import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useDataProvider } from "ra-core";
import { Navigate } from "react-router";

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

  if (isPending) return null;
  if (!business) return <Navigate to={SetupPage.path} replace />;
  return <>{children}</>;
};
