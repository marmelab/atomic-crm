import { Notification } from "@/components/admin/notification";
import { useTranslate } from "ra-core";
import { useConfigurationContext } from "../root/ConfigurationContext";

export const ConfirmationRequired = () => {
  const { darkModeLogo: logo, title } = useConfigurationContext();
  const translate = useTranslate();

  return (
    <div className="h-screen p-8">
      <div className="flex items-center gap-4">
        <img
          src={logo}
          alt={title}
          width={24}
          className="filter brightness-0 invert"
        />
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      <div className="h-full text-center">
        <div className="max-w-sm mx-auto h-full flex flex-col justify-center gap-4">
          <h1 className="text-2xl font-bold mb-4">
            {translate("crm.signup.title", { _: "Welcome to Atomic CRM" })}
          </h1>
          <p className="text-base mb-4">
            {translate("crm.signup.confirmation_required", {
              _:
                "Please follow the link we just sent you by email to confirm your account.",
            })}
          </p>
        </div>
      </div>
      <Notification />
    </div>
  );
};

ConfirmationRequired.path = "/sign-up/confirm";
