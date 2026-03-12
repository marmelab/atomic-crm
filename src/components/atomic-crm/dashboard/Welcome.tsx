import { useTranslate } from "ra-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Welcome = () => {
  const translate = useTranslate();

  return (
    <Card>
      <CardHeader className="px-4">
        <CardTitle>{translate("crm.dashboard.welcome.title")}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-sm mb-4">
          <a
            href="https://marmelab.com/atomic-crm"
            className="underline hover:no-underline"
          >
            Atomic CRM
          </a>{" "}
          {translate("crm.dashboard.welcome.paragraph_1")}
        </p>
        <p className="text-sm mb-4">
          {translate("crm.dashboard.welcome.paragraph_2")}
        </p>
        <p className="text-sm">
          {translate("crm.dashboard.welcome.powered_by")}{" "}
          <a
            href="https://marmelab.com/shadcn-admin-kit"
            className="underline hover:no-underline"
          >
            shadcn-admin-kit
          </a>{" "}
          {translate("crm.dashboard.welcome.paragraph_3")}{" "}
          <a
            href="https://github.com/marmelab/atomic-crm"
            className="underline hover:no-underline"
          >
            marmelab/atomic-crm
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
};
