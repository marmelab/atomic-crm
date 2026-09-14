import { useGetOne, useTranslate } from "ra-core";
import { useWatch } from "react-hook-form";

import type { Company } from "../types";

/**
 * Hint under the company input telling how many contacts the selected company
 * already has, so the user notices they are joining an existing account.
 */
export const CompanyContactsCount = () => {
  const translate = useTranslate();
  const companyId = useWatch({ name: "company_id" });
  const { data: company } = useGetOne<Company>(
    "companies",
    { id: companyId },
    { enabled: companyId != null && companyId !== "" },
  );

  if (!company) return null;

  return (
    <p className="text-sm text-muted-foreground -mt-2">
      {translate("resources.contacts.company_contacts_count", {
        smart_count: company.nb_contacts ?? 0,
      })}
    </p>
  );
};
