import { useTranslate } from "ra-core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Welcome = () => {
  const translate = useTranslate();
  return (
    <Card>
      <CardHeader className="px-4">
        <CardTitle>{translate("crm.welcome.title")}</CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-sm mb-4">
          <a
            href="https://marmelab.com/atomic-crm"
            className="underline hover:no-underline"
          >
            Atomic CRM
          </a>{" "}
          {translate("crm.welcome.description")}
        </p>
        <p className="text-sm mb-4">
          {translate("crm.welcome.demo_description")}
        </p>
        <p className="text-sm">
          {translate("crm.welcome.powered_by")}{" "}
          <a
            href="https://marmelab.com/shadcn-admin-kit"
            className="underline hover:no-underline"
          >
            shadcn-admin-kit
          </a>
          {translate("crm.welcome.open_source_suffix")}{" "}
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
