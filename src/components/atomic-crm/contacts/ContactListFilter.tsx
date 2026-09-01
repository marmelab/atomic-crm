import { BookOpen, CheckSquare, ShieldCheck, Users } from "lucide-react";
import { useGetList, useListContext, useTranslate } from "ra-core";
import { ToggleFilterButton } from "@/components/admin/toggle-filter-button";

import { FilterCategory } from "../filters/FilterCategory";
import { ResponsiveFilters } from "../misc/ResponsiveFilters";
import { useIsMobile } from "@/hooks/use-mobile";
import { ActiveFilterButton } from "../misc/ActiveFilterButton";
import type { Offer } from "../types";

// Contacts UX cleanup pass: replaces the generic Atomic CRM filter set
// (last_seen date ranges, Cold/Warm/Hot/In Contract note temperature,
// generic fixture tags, "Me"/account-manager) with filters backed by this
// CRM's own real domain relationships — every value here reads a genuine
// structured field or a derived contacts_summary column (see that view's
// own header, and providers/fakerest/contactRelationshipFields.ts for the
// dev/demo mirror), never an inferred/fabricated lifecycle state.
export const ContactListFilter = () => {
  const isMobile = useIsMobile();
  const translate = useTranslate();
  const { data: offers } = useGetList<Offer>("offers", {
    pagination: { page: 1, perPage: 20 },
    sort: { field: "name", order: "ASC" },
  });

  return (
    <ResponsiveFilters
      // Unlike ToggleFilterButton/ActiveFilterButton's own `label` (a
      // translation key they resolve internally), SearchInput's
      // `placeholder` is a plain HTML input attribute — it needs the
      // already-translated string, not the key itself.
      searchInput={{
        placeholder: translate("resources.contacts.filters.search"),
      }}
    >
      <FilterCategory
        label="resources.contacts.filters.relationship"
        icon={<Users />}
      >
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="resources.contacts.filters.current_client"
          value={{ is_current_client: true }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="resources.contacts.filters.past_client"
          value={{ is_past_client: true }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="resources.contacts.filters.applicant"
          value={{ has_applied: true }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="resources.contacts.filters.waitlist"
          value={{ is_on_waitlist: true }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="resources.contacts.filters.nurture"
          value={{ has_nurture_deal: true }}
          size={isMobile ? "lg" : undefined}
        />
      </FilterCategory>

      <FilterCategory
        label="resources.contacts.filters.sales_eligibility"
        icon={<ShieldCheck />}
      >
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="resources.contacts.filters.eligibility_normal"
          value={{ sales_eligibility: "normal" }}
          size={isMobile ? "lg" : undefined}
        />
        <ToggleFilterButton
          className="w-auto md:w-full justify-between h-10 md:h-8"
          label="resources.contacts.filters.eligibility_dne"
          value={{ sales_eligibility: "do_not_engage" }}
          size={isMobile ? "lg" : undefined}
        />
      </FilterCategory>

      {offers && offers.length > 0 && (
        <FilterCategory
          label="resources.contacts.filters.offer_history"
          icon={<BookOpen />}
        >
          {offers.map((offer) => (
            <ToggleFilterButton
              className="w-auto md:w-full justify-between h-10 md:h-8"
              key={offer.id}
              label={offer.name}
              value={{ "offer_ids@cs": `{${offer.id}}` }}
              size={isMobile ? "lg" : undefined}
            />
          ))}
        </FilterCategory>
      )}

      <FilterCategory
        icon={<CheckSquare />}
        label="resources.contacts.filters.tasks"
      >
        <ToggleFilterButton
          className="w-full justify-between h-10 md:h-8"
          label="resources.tasks.filters.with_pending"
          value={{ "nb_tasks@gt": 0 }}
          size={isMobile ? "lg" : undefined}
        />
      </FilterCategory>
    </ResponsiveFilters>
  );
};

export const ContactListFilterSummary = () => {
  const { data: offers } = useGetList<Offer>("offers", {
    pagination: { page: 1, perPage: 20 },
    sort: { field: "name", order: "ASC" },
  });
  const { filterValues } = useListContext();
  const hasFilters = !!Object.entries(filterValues || {}).filter(
    ([key]) => key !== "q",
  ).length;

  if (!hasFilters) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-start mb-4 gap-1">
      <ActiveFilterButton
        className="w-auto justify-between h-8"
        label="resources.contacts.filters.current_client"
        value={{ is_current_client: true }}
      />
      <ActiveFilterButton
        className="w-auto justify-between h-8"
        label="resources.contacts.filters.past_client"
        value={{ is_past_client: true }}
      />
      <ActiveFilterButton
        className="w-auto justify-between h-8"
        label="resources.contacts.filters.applicant"
        value={{ has_applied: true }}
      />
      <ActiveFilterButton
        className="w-auto justify-between h-8"
        label="resources.contacts.filters.waitlist"
        value={{ is_on_waitlist: true }}
      />
      <ActiveFilterButton
        className="w-auto justify-between h-8"
        label="resources.contacts.filters.nurture"
        value={{ has_nurture_deal: true }}
      />

      <ActiveFilterButton
        className="w-auto justify-between h-8"
        label="resources.contacts.filters.eligibility_normal"
        value={{ sales_eligibility: "normal" }}
      />
      <ActiveFilterButton
        className="w-auto justify-between h-8"
        label="resources.contacts.filters.eligibility_dne"
        value={{ sales_eligibility: "do_not_engage" }}
      />

      {offers &&
        offers.map((offer) => (
          <ActiveFilterButton
            className="w-auto justify-between h-8"
            key={offer.id}
            label={offer.name}
            value={{ "offer_ids@cs": `{${offer.id}}` }}
          />
        ))}

      <ActiveFilterButton
        className="w-auto justify-between h-8"
        label="resources.tasks.filters.with_pending"
        value={{ "nb_tasks@gt": 0 }}
      />
    </div>
  );
};
