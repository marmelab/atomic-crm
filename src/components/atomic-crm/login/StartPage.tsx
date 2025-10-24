import { useDataProvider } from "ra-core";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { LoginPage } from "@/components/admin";
import type { CrmDataProvider } from "@/components/atomic-crm/providers/types";
import { LoginSkeleton } from "@/components/atomic-crm/login/LoginSkeleton";

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
