import type { DataProvider, Identifier } from "ra-core";

import {
  COMPANY_CREATED,
  CONTACT_CREATED,
  CONTACT_NOTE_CREATED,
  DEAL_CREATED,
  DEAL_NOTE_CREATED,
} from "../../consts";
import type {
  Activity,
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
} from "../../types";

export async function getActivityLog(
  dataProvider: DataProvider,
  companyId?: Identifier,
  salesId?: Identifier,
) {
  const filter = {} as any;
  if (companyId) {
    filter.company_id = companyId;
  } else if (salesId) {
    filter["sales_id@in"] = `(${salesId})`;
  }

  const { data } = await dataProvider.getList<Activity>("activity_log", {
    filter,
    pagination: { page: 1, perPage: 250 },
    sort: { field: "date", order: "DESC" },
  });

  return data;
}
