import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";
import { Navigate } from "react-router-dom";
import { LoginPage } from "@/components/admin/login-page";

import type { CrmDataProvider } from "../providers/types";
import { LoginSkeleton } from "./LoginSkeleton";

export const StartPage = () => {
  const dataProvider = useDataProvider<CrmDataProvider>();
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

  return <Navigate to="/sign-up" />;
};
