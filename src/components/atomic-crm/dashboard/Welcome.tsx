import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslate } from "ra-core";

export const Welcome = () => {
  const translate = useTranslate();
  return (
    <Card>
      <CardHeader className="px-4">
        <CardTitle>
          {translate("crm.dashboard.welcome.title", {
            _: "Your CRM Starter Kit",
          })}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <p className="text-sm mb-4">
          <a
            href="https://marmelab.com/atomic-crm"
            className="underline hover:no-underline"
          >
            Atomic CRM
          </a>{" "}
          {translate("crm.dashboard.welcome.paragraph_1", {
            _: "is a template designed to help you quickly build your own CRM.",
          })}
        </p>
        <p className="text-sm mb-4">
          {translate("crm.dashboard.welcome.paragraph_2", {
            _: "This demo runs on a mock API, so you can explore and modify the data. It resets on reload. The full version uses Supabase for the backend.",
          })}
        </p>
        <p className="text-sm">
          {translate("crm.dashboard.welcome.powered_by", { _: "Powered by" })}{" "}
          <a
            href="https://marmelab.com/shadcn-admin-kit"
            className="underline hover:no-underline"
          >
            shadcn-admin-kit
          </a>
          {translate("crm.dashboard.welcome.paragraph_3", {
            _: ", Atomic CRM is fully open-source. You can find the code at",
          })}{" "}
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
