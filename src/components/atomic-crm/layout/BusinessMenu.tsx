import { useQuery } from "@tanstack/react-query";
import { Building2, Check } from "lucide-react";
import {
  useDataProvider,
  useNotify,
  useStoreContext,
  useTranslate,
  useUserMenu,
} from "ra-core";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import type { CrmDataProvider } from "../providers/types";
import { CONFIGURATION_STORE_KEY } from "../root/ConfigurationContext";

/**
 * Lists the businesses of the current user in the user menu and switches
 * between them. Switching reloads the app: every cached record belongs to the
 * previous business.
 */
export const BusinessMenu = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const store = useStoreContext();
  const userMenuContext = useUserMenu();
  const dataProvider = useDataProvider<CrmDataProvider>();

  const { data } = useQuery({
    queryKey: ["businesses", "mine"],
    queryFn: async () => {
      const [businesses, current] = await Promise.all([
        dataProvider.getMyBusinesses(),
        dataProvider.getCurrentBusinessId(),
      ]);
      return { businesses, current };
    },
  });

  if (!data || data.businesses.length === 0) {
    return null;
  }

  const handleSwitch = async (businessId: string) => {
    userMenuContext?.onClose();
    if (businessId === data.current) return;
    try {
      await dataProvider.switchBusiness(businessId);
      store.removeItem(CONFIGURATION_STORE_KEY);
      window.location.assign(window.location.pathname);
    } catch {
      notify("crm.business.switch_error", {
        type: "error",
        messageArgs: { _: "Could not switch business" },
      });
    }
  };

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>
          {translate("crm.business.label", { _: "Business" })}
        </DropdownMenuLabel>
        {data.businesses.map((business) => (
          <DropdownMenuItem
            key={business.business_id}
            onClick={() => handleSwitch(business.business_id)}
            className="flex items-center gap-2"
          >
            <Building2 />
            <span className="grow truncate">{business.name}</span>
            {business.business_id === data.current ? (
              <Check
                aria-label={translate("crm.business.current", {
                  _: "Current business",
                })}
              />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </>
  );
};
