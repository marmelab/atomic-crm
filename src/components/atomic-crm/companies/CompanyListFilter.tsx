import { Building, Truck, Users } from "lucide-react";
import { useGetIdentity } from "ra-core";
import { ToggleFilterButton } from "@/components/admin/toggle-filter-button";

import { FilterCategory } from "../filters/FilterCategory";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { sizes } from "./sizes";
import { ResponsiveFilters } from "../misc/ResponsiveFilters";
import { useIsMobile } from "@/hooks/use-mobile";

export const CompanyListFilter = () => {
  const { identity } = useGetIdentity();
  const isMobile = useIsMobile();
  const { companySectors } = useConfigurationContext();
  const sectors = companySectors.map((sector) => ({
    id: sector,
    name: sector,
  }));
  return (
    <ResponsiveFilters searchInput={{ placeholder: "Name, sector" }}>
      <FilterCategory icon={<Building className="h-4 w-4" />} label="Size">
        {sizes.map((size) => (
          <ToggleFilterButton
            className="w-auto md:w-full justify-between"
            label={isMobile ? size.shortName : size.name}
            value={{ size: size.id }}
          />
        ))}
      </FilterCategory>

      <FilterCategory icon={<Truck className="h-4 w-4" />} label="Sector">
        {sectors.map((sector) => (
          <ToggleFilterButton
            className="w-auto md:w-full justify-between"
            label={sector.name}
            value={{ sector: sector.id }}
          />
        ))}
      </FilterCategory>

      <FilterCategory
        icon={<Users className="h-4 w-4" />}
        label="Account Manager"
      >
        <ToggleFilterButton
          className="w-full justify-between"
          label={"Me"}
          value={{ sales_id: identity?.id }}
        />
      </FilterCategory>
    </ResponsiveFilters>
  );
};
