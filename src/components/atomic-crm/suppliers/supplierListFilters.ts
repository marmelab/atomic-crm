type FilterValues = Record<string, unknown>;

const toFilterKey = (field: string) => `${field}@ilike`;

export const getSupplierTextFilterValue = (
  filterValues: FilterValues,
  field: string,
) =>
  ((filterValues[toFilterKey(field)] as string | undefined) ?? "").replace(
    /%/g,
    "",
  );

export const patchSupplierTextFilter = ({
  filterValues,
  field,
  value,
}: {
  filterValues: FilterValues;
  field: "name" | "vat_number" | "fiscal_code" | "billing_city" | "email";
  value: string;
}) => {
  const normalized = value.trim();
  const next = { ...filterValues };
  const key = toFilterKey(field);

  if (!normalized) {
    delete next[key];
    return next;
  }

  next[key] = `%${normalized}%`;
  return next;
};
