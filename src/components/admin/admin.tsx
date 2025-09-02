import { CoreAdmin, CoreAdminProps } from "ra-core";
import { i18nProvider } from "@/lib/i18nProvider";
import { Layout } from "@/components/admin/layout";
import { LoginPage } from "@/components/admin/login-page";
import { Ready } from "@/components/admin/ready";
import { ThemeProvider } from "@/components/admin/theme-provider";

export const Admin = (props: CoreAdminProps) => {
  return (
    <ThemeProvider>
      <CoreAdmin
        i18nProvider={i18nProvider}
        layout={Layout}
        loginPage={LoginPage}
        ready={Ready}
        {...props}
      />
    </ThemeProvider>
  );
};
