import { useQuery } from "@tanstack/react-query";
import { Check, Plus, SlidersHorizontal } from "lucide-react";
import {
  CanAccess,
  useDataProvider,
  useNotify,
  useStoreContext,
  useTranslate,
} from "ra-core";
import { Link } from "react-router";

import type { CrmDataProvider } from "../providers/types";
import { CONFIGURATION_STORE_KEY } from "../root/ConfigurationContext";
import { BusinessSettingsPage } from "./BusinessSettingsPage";
import { reloadApp } from "./reloadApp";
import { SetupPage } from "./SetupPage";

/** The businesses of the user on the phone settings screen: switch, manage, add. */
export const MobileBusinessSection = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const store = useStoreContext();
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

  if (!data) return null;

  const switchTo = async (businessId: string) => {
    if (businessId === data.current) return;
    try {
      await dataProvider.switchBusiness(businessId);
      store.removeItem(CONFIGURATION_STORE_KEY);
      reloadApp();
    } catch {
      notify("crm.business.switch_error", { type: "error" });
    }
  };

  const rowClass =
    "flex min-h-12 w-full items-center gap-3 px-4 text-left text-base";

  return (
    <section aria-labelledby="mobile-business" className="flex flex-col gap-2">
      <h2
        id="mobile-business"
        className="px-1 text-sm font-medium text-muted-foreground"
      >
        {translate("crm.business.label")}
      </h2>
      <div className="flex flex-col divide-y divide-border rounded-lg bg-card">
        {data.businesses.map((business) => (
          <button
            key={business.business_id}
            type="button"
            className={rowClass}
            aria-current={business.business_id === data.current}
            onClick={() => switchTo(business.business_id)}
          >
            <span className="grow truncate">{business.name}</span>
            {business.business_id === data.current ? (
              <Check className="size-5 text-primary" />
            ) : null}
          </button>
        ))}
        <CanAccess resource="configuration" action="edit">
          <Link to={BusinessSettingsPage.path} className={rowClass}>
            <SlidersHorizontal className="size-5 text-muted-foreground" />
            {translate("crm.business_settings.title")}
          </Link>
        </CanAccess>
        <Link to={SetupPage.path} className={rowClass}>
          <Plus className="size-5 text-muted-foreground" />
          {translate("crm.setup.title_another")}
        </Link>
      </div>
    </section>
  );
};
