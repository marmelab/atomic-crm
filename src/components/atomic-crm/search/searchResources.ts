import { Building2, DollarSign, FileText, ListTodo, User } from "lucide-react";
import type { ComponentType } from "react";

import type { SearchResourceName } from "../types";

export type SearchResourceDescriptor = {
  name: SearchResourceName;
  icon: ComponentType<{ className?: string }>;
  labelKey: string;
};

/** Result groups, in the order they appear in the search dialog. */
export const SEARCH_RESOURCES: SearchResourceDescriptor[] = [
  { name: "contacts", icon: User, labelKey: "crm.search.groups.contacts" },
  {
    name: "companies",
    icon: Building2,
    labelKey: "crm.search.groups.companies",
  },
  { name: "deals", icon: DollarSign, labelKey: "crm.search.groups.deals" },
  { name: "tasks", icon: ListTodo, labelKey: "crm.search.groups.tasks" },
  {
    name: "contact_notes",
    icon: FileText,
    labelKey: "crm.search.groups.contact_notes",
  },
  {
    name: "deal_notes",
    icon: FileText,
    labelKey: "crm.search.groups.deal_notes",
  },
];

export const DESKTOP_SEARCH_RESOURCES: SearchResourceName[] =
  SEARCH_RESOURCES.map(({ name }) => name);

export const MOBILE_SEARCH_RESOURCES: SearchResourceName[] =
  DESKTOP_SEARCH_RESOURCES.filter(
    (name) => name !== "deals" && name !== "deal_notes",
  );
