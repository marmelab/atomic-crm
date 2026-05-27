import {
  Building,
  FileDown,
  Handshake,
  Sparkles,
  Truck,
  Users,
} from "lucide-react";
import { useGetIdentity, useTranslate } from "ra-core";
import { ToggleFilterButton } from "@/components/admin/toggle-filter-button";
import { useIsMobile } from "@/hooks/use-mobile";

import { FilterCategory } from "../filters/FilterCategory";
import { ResponsiveFilters } from "../misc/ResponsiveFilters";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { getTranslatedCompanySizeLabel } from "./getTranslatedCompanySizeLabel";
import { sizes } from "./sizes";

// All relationsstatus-filter use a unique key "status_preset" to avoid key conflicts
const activeCustomersFilter = { status_preset: "active_customers" };
const companiesUnderNegotiationFilter = { status_preset: "under_negotiation" };
const companiesForFollowupFilter = { status_preset: "follow_up" };
const hotLeadsFilter = { status_preset: "hot_leads" };
const neverContactedFilter = { status_preset: "never_contacted" };
const contactedNoResponseFilter = { status_preset: "no_response" };
const notInterestedFilter = { status_preset: "not_interested" };

export const CompanyListFilter = () => {
  const { identity } = useGetIdentity();
  const { companySectors } = useConfigurationContext();
  const translate = useTranslate();
  const isMobile = useIsMobile();
  const translatedSizes = sizes.map((size) => ({
    ...size,
    name: getTranslatedCompanySizeLabel(size, translate),
  }));
  const toggleClassName = "w-auto md:w-full justify-between h-10 md:h-8";
  const toggleSize = isMobile ? ("lg" as const) : undefined;
  return (
    <ResponsiveFilters>
      <FilterCategory
        icon={<Building className="h-4 w-4" />}
        label="resources.companies.fields.size"
      >
        {translatedSizes.map((size) => (
          <ToggleFilterButton
            className={toggleClassName}
            label={size.name}
            key={size.name}
            value={{ size: size.id }}
            size={toggleSize}
          />
        ))}
      </FilterCategory>

      <FilterCategory
        icon={<Truck className="h-4 w-4" />}
        label="resources.companies.fields.sector"
      >
        {companySectors.map((sector) => (
          <ToggleFilterButton
            className={toggleClassName}
            label={sector.label}
            key={sector.value}
            value={{ sector: sector.value }}
            size={toggleSize}
          />
        ))}
      </FilterCategory>

      <FilterCategory
        icon={<Users className="h-4 w-4" />}
        label="resources.companies.fields.sales_id"
      >
        <ToggleFilterButton
          className={toggleClassName}
          label={translate("crm.common.me")}
          value={{ sales_id: identity?.id }}
          size={toggleSize}
        />
      </FilterCategory>

      <FilterCategory
        icon={<Sparkles className="h-4 w-4" />}
        label="Lead Segment"
      >
        <ToggleFilterButton
          className={toggleClassName}
          label="Heta leads"
          value={{ "segment@eq": "hot_lead" }}
          size={toggleSize}
        />
        <ToggleFilterButton
          className={toggleClassName}
          label="Varma leads"
          value={{ "segment@eq": "warm_lead" }}
          size={toggleSize}
        />
        <ToggleFilterButton
          className={toggleClassName}
          label="Kalla leads"
          value={{ "segment@eq": "cold_lead" }}
          size={toggleSize}
        />
        <ToggleFilterButton
          className={toggleClassName}
          label="Har Facebook"
          value={{ "has_facebook@eq": true }}
          size={toggleSize}
        />
        <ToggleFilterButton
          className={toggleClassName}
          label="Har Instagram"
          value={{ "has_instagram@eq": true }}
          size={toggleSize}
        />
        <ToggleFilterButton
          className={toggleClassName}
          label="Saknar hemsida"
          value={{ "website_quality@eq": "none" }}
          size={toggleSize}
        />
        <ToggleFilterButton
          className={toggleClassName}
          label="Dålig hemsida"
          value={{ "website_quality@eq": "poor" }}
          size={toggleSize}
        />
      </FilterCategory>

      <FilterCategory
        icon={<FileDown className="h-4 w-4" />}
        label="Import & Prospektering"
      >
        <ToggleFilterButton
          className={toggleClassName}
          label="Importerade"
          value={{ "source@eq": "import" }}
          size={toggleSize}
        />
        <ToggleFilterButton
          className={toggleClassName}
          label="Redo att ringa"
          value={{ "prospecting_status@eq": "call_ready" }}
          size={toggleSize}
        />
        <ToggleFilterButton
          className={toggleClassName}
          label="Behöver granskning"
          value={{ "prospecting_status@eq": "needs_review" }}
          size={toggleSize}
        />
        <ToggleFilterButton
          className={toggleClassName}
          label="Nyimporterade"
          value={{ "prospecting_status@eq": "imported" }}
          size={toggleSize}
        />
        <ToggleFilterButton
          className={toggleClassName}
          label="Diskvalificerade"
          value={{ "prospecting_status@eq": "disqualified" }}
          size={toggleSize}
        />
      </FilterCategory>

      <FilterCategory
        icon={<Handshake className="h-4 w-4" />}
        label="Relationsstatus"
      >
        <ToggleFilterButton
          className={toggleClassName}
          label="🔥 Heta leads"
          value={hotLeadsFilter}
          size={toggleSize}
        />
        <ToggleFilterButton
          className={toggleClassName}
          label={translate("resources.companies.filters.active_customers", {
            _: "Aktiva kunder",
          })}
          value={activeCustomersFilter}
          size={toggleSize}
        />
        <ToggleFilterButton
          className={toggleClassName}
          label={translate("resources.companies.filters.under_negotiation", {
            _: "Under förhandling",
          })}
          value={companiesUnderNegotiationFilter}
          size={toggleSize}
        />
        <ToggleFilterButton
          className={toggleClassName}
          label={translate("resources.companies.filters.follow_up", {
            _: "Att följa upp",
          })}
          value={companiesForFollowupFilter}
          size={toggleSize}
        />
        <ToggleFilterButton
          className={toggleClassName}
          label="Aldrig kontaktade"
          value={neverContactedFilter}
          size={toggleSize}
        />
        <ToggleFilterButton
          className={toggleClassName}
          label="Kontaktade, inget svar"
          value={contactedNoResponseFilter}
          size={toggleSize}
        />
        <ToggleFilterButton
          className={toggleClassName}
          label="Inte intresserade"
          value={notInterestedFilter}
          size={toggleSize}
        />
      </FilterCategory>
    </ResponsiveFilters>
  );
};
