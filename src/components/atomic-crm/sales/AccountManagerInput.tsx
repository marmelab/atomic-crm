import {
  useCanAccess,
  useGetIdentity,
  useGetList,
  useTranslate,
} from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { ToggleFilterButton } from "@/components/admin/toggle-filter-button";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Sale } from "../types";

const MAX_DISPLAYED_SALES = 10;

const saleOptionRenderer = (choice: Sale) =>
  `${choice.first_name} ${choice.last_name}`;

export const AccountManagerInput = ({
  source = "sales_id",
}: {
  source?: string;
  alwaysOn?: boolean;
}) => {
  const translate = useTranslate();
  const isMobile = useIsMobile();
  return (
    <ReferenceInput
      source={source}
      reference="sales"
      filter={{ "disabled@neq": true }}
      sort={{ field: "last_name", order: "ASC" }}
    >
      <AutocompleteInput
        label={false}
        helperText={false}
        clearable
        modal={isMobile}
        optionText={saleOptionRenderer}
        placeholder={translate("crm.common.account_manager")}
      />
    </ReferenceInput>
  );
};

export const AccountManagerFilter = ({
  className,
  size,
}: {
  className?: string;
  size?: "default" | "sm" | "lg" | "icon" | null;
}) => {
  const { identity } = useGetIdentity();
  const { canAccess } = useCanAccess({ resource: "sales", action: "list" });
  const { data: sales } = useGetList<Sale>(
    "sales",
    {
      pagination: { page: 1, perPage: MAX_DISPLAYED_SALES },
      sort: { field: "last_name", order: "ASC" },
      filter: { "disabled@neq": true, "id@neq": identity?.id },
    },
    { enabled: canAccess === true && identity?.id != null },
  );

  if (!canAccess || !sales?.length) return null;

  return (
    <>
      {sales.map((sale) => (
        <ToggleFilterButton
          key={sale.id}
          className={className}
          label={
            <span className="min-w-0 truncate">{saleOptionRenderer(sale)}</span>
          }
          size={size}
          value={{ sales_id: sale.id }}
        />
      ))}
    </>
  );
};
