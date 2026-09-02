import type { FormHTMLAttributes } from "react";
import { FilterLiveForm, useTranslate } from "ra-core";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Sale } from "../types";

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

const FullWidthForm = (props: FormHTMLAttributes<HTMLFormElement>) => (
  <form className="w-full" {...props} />
);

export const AccountManagerFilter = () => (
  <FilterLiveForm formComponent={FullWidthForm}>
    <AccountManagerInput />
  </FilterLiveForm>
);
