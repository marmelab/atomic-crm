import { Building, Truck, Users } from "lucide-react";
import { FilterLiveForm, useGetIdentity, useTranslate } from "ra-core";
import { ToggleFilterButton } from "@/components/admin/toggle-filter-button";
import { SearchInput } from "@/components/admin/search-input";

import { FilterCategory } from "../filters/FilterCategory";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { sizes } from "./sizes";

export const CompanyListFilter = () => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const { companySectors } = useConfigurationContext();
  return (
    <div className="w-52 min-w-52 flex flex-col gap-8">
      <FilterLiveForm>
        <SearchInput source="q" />
      </FilterLiveForm>

      <FilterCategory
        icon={<Building className="h-4 w-4" />}
        label={translate("resources.companies.fields.size", { _: "Size" })}
      >
        {sizes.map((size) => (
          <ToggleFilterButton
            className="w-full justify-between"
            label={size.name}
            key={size.name}
            value={{ size: size.id }}
          />
        ))}
      </FilterCategory>

      <FilterCategory
        icon={<Truck className="h-4 w-4" />}
        label={translate("resources.companies.fields.sector", { _: "Sector" })}
      >
        {companySectors.map((sector) => (
          <ToggleFilterButton
            className="w-full justify-between"
            label={sector.label}
            key={sector.value}
            value={{ sector: sector.value }}
          />
        ))}
      </FilterCategory>

      <FilterCategory
        icon={<Users className="h-4 w-4" />}
        label={translate("crm.filters.account_manager", { _: "Account Manager" })}
      >
        <ToggleFilterButton
          className="w-full justify-between"
          label={translate("crm.filters.me", { _: "Me" })}
          value={{ sales_id: identity?.id }}
        />
      </FilterCategory>
    </div>
  );
};
