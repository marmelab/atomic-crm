/** Form-only field of the existing contact search, stripped before saving. */
export const CONTACT_SEARCH_SOURCE = "contact_search";

export const omitContactSearch = ({
  [CONTACT_SEARCH_SOURCE]: _search,
  ...values
}: Record<string, unknown>) => values;
