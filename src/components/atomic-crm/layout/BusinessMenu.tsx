import { useQuery } from "@tanstack/react-query";
import { Building2, Check, Plus, SlidersHorizontal } from "lucide-react";
import {
  CanAccess,
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

import { Link } from "react-router";

import { BusinessSettingsPage } from "../business/BusinessSettingsPage";
import { SetupPage } from "../business/SetupPage";
import { reloadApp } from "../business/reloadApp";
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
      reloadApp();
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
        <CanAccess resource="configuration" action="edit">
          <DropdownMenuItem
            onClick={userMenuContext?.onClose}
            render={
              <Link
                to={BusinessSettingsPage.path}
                className="flex items-center gap-2"
              />
            }
          >
            <SlidersHorizontal />
            {translate("crm.business_settings.title", { _: "Business" })}
          </DropdownMenuItem>
        </CanAccess>
        <DropdownMenuItem
          onClick={userMenuContext?.onClose}
          render={
            <Link to={SetupPage.path} className="flex items-center gap-2" />
          }
        >
          <Plus />
          {translate("crm.setup.title_another", { _: "Add a business" })}
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </>
  );
};
