import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getSupabaseClient } from "../providers/supabase/supabase";

export interface CompanySector {
  value: string;
  label: string;
}

/**
 * Convert an industry display name to a URL-friendly slug, e.g.
 * "SEO & Search Marketing" -> "seo-and-search-marketing".
 * Returns null when the name contains no usable characters.
 */
export const slugifyIndustryLabel = (label: string): string | null => {
  const value = label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return value || null;
};

/**
 * Find a sector matching a label, case-insensitively.
 */
export const findSectorByLabel = (sectors: CompanySector[], label: string) =>
  sectors.find(
    (sector) =>
      sector.label.trim().toLowerCase() === label.trim().toLowerCase(),
  );

/**
 * Build a unique slug for a new industry, suffixing "-2", "-3", ... on collision.
 */
export const nextAvailableSectorValue = (
  sectors: CompanySector[],
  label: string,
): string | null => {
  const base = slugifyIndustryLabel(label);
  if (!base) return null;

  let value = base;
  let suffix = 2;
  while (sectors.some((sector) => sector.value === value)) {
    value = `${base}-${suffix}`;
    suffix++;
  }
  return value;
};

/**
 * Escape a string for a PostgREST `ilike` filter.
 */
const escapeIlike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

/**
 * Fetch all industries from the public.company_sectors table.
 *
 * Industries are shared between all authenticated users: use this hook
 * instead of the ConfigurationContext companySectors for the company form.
 */
export const useCompanySectors = () => {
  const query = useQuery({
    queryKey: ["company_sectors"],
    queryFn: async (): Promise<CompanySector[]> => {
      const { data, error } = await getSupabaseClient()
        .from("company_sectors")
        .select("value,label")
        .order("label");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  return {
    sectors: query.data ?? [],
    error: query.error,
    isPending: query.isPending,
    isFetching: query.isFetching,
  };
};

/**
 * Create a new industry in public.company_sectors.
 *
 * Duplicate safety: resolves to the existing record when the insert hits a
 * unique constraint (value or lowercase label), whether the duplicate was
 * created earlier by another user or concurrently by a team member.
 */
export const useCreateCompanySector = () => {
  const queryClient = useQueryClient();

  return useMutation<CompanySector, Error, CompanySector>({
    mutationKey: ["company_sectors", "create"],
    mutationFn: async ({ value, label }) => {
      const client = getSupabaseClient();

      const { data, error } = await client
        .from("company_sectors")
        .insert({ value, label: label.trim() })
        .select("value,label")
        .single();

      if (!error) return data;

      // Unique constraint violation: another row with the same value or
      // label already exists. Retrieve it instead of failing.
      if (error.code === "23505") {
        const trimmed = label.trim();

        const { data: byValue } = await client
          .from("company_sectors")
          .select("value,label")
          .eq("value", value)
          .maybeSingle();
        if (byValue) return byValue;

        const { data: byLabel, error: labelError } = await client
          .from("company_sectors")
          .select("value,label")
          .ilike("label", escapeIlike(trimmed))
          .limit(1);
        if (labelError) throw labelError;
        if (byLabel && byLabel.length > 0) return byLabel[0];
      }

      throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company_sectors"] });
    },
  });
};
