import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import { Navigate } from "react-router-dom";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { CrmDataProvider } from "../providers/types";
import { LoginSkeleton } from "./LoginSkeleton";
import { LoginPage } from "./LoginPage";

export const StartPage = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const { disableEmailPasswordAuthentication } = useConfigurationContext();
  const {
    data: isInitialized,
    error,
    isPending,
  } = useQuery({
    queryKey: ["init"],
    queryFn: async () => {
      return dataProvider.isInitialized();
    },
  });

  if (isPending) return <LoginSkeleton />;
  if (error) return <LoginPage />;
  if (isInitialized) return <LoginPage />;
  if (disableEmailPasswordAuthentication) return <LoginPage />;

  return <Navigate to="/sign-up" />;
};
