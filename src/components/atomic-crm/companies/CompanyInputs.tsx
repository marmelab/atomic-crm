"use client";

import { useState, type FormEvent } from "react";
import {
  required,
  useTranslate,
  useCreateSuggestionContext,
  useNotify,
} from "ra-core";

import { DateInput } from "@/components/admin/date-input";
import { TextInput } from "@/components/admin/text-input";
import { SelectInput } from "@/components/admin/select-input";

import {
  findSectorByLabel,
  nextAvailableSectorValue,
  useCompanySectors,
  useCreateCompanySector,
} from "./useCompanySectors";

export const CompanyInputs = () => (
  <div className="flex flex-col gap-4 p-1">
    <CompanyLeadInputs />

    <TextInput
      source="pitch_point"
      multiline
      helperText={false}
      className="[&_textarea]:min-h-32"
    />
  </div>
);

const CompanyLeadInputs = () => {
  const translate = useTranslate();

  const { sectors, isPending, error } = useCompanySectors();

  const verticalChoices = sectors.map((sector) => ({
    id: sector.value,
    name: sector.label,
  }));

  return (
    <div className="flex flex-col gap-4">
      <h6 className="text-lg font-semibold">
        {translate("resources.companies.field_categories.lead", {
          _: "Lead",
        })}
      </h6>

      <div className="grid gap-4 md:grid-cols-2">
        <DateInput source="lead_date" helperText={false} />

        <TextInput source="name" validate={required()} helperText={false} />

        <SelectInput
          source="sector"
          choices={verticalChoices}
          optionText="name"
          optionValue="id"
          helperText={
            error ? "Failed to load verticals from the database." : false
          }
          isPending={isPending}
          create={<CreateIndustrySuggestion />}
          createLabel="Add a new vertical"
        />

        <TextInput source="city" helperText={false} />
      </div>
    </div>
  );
};

/**
 * Custom industry creation.
 * Uses the existing SelectInput create suggestion mechanism, and persists the
 * new industry in the public.company_sectors table so every user sees it.
 */
const CreateIndustrySuggestion = () => {
  const { onCancel, onCreate } = useCreateSuggestionContext();
  const notify = useNotify();

  const { sectors } = useCompanySectors();
  const { mutateAsync: createSector, isPending: isCreating } =
    useCreateCompanySector();

  const [industryName, setIndustryName] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCreating) return;

    const label = industryName.trim();

    // Reject empty or whitespace-only names.
    if (!label) return;

    // Check for an existing industry by its display name (case-insensitive).
    const existingIndustry = findSectorByLabel(sectors, label);

    // If it already exists, select the existing industry.
    if (existingIndustry) {
      onCreate({
        id: existingIndustry.value,
        name: existingIndustry.label,
      });
      return;
    }

    // Generate a URL-friendly value free of collisions.
    const value = nextAvailableSectorValue(sectors, label);
    if (!value) return;

    try {
      // Insert into Supabase. On a unique constraint violation (e.g. another
      // user created the same industry concurrently), the mutation resolves
      // to the existing record instead of failing.
      const newIndustry = await createSector({ value, label });

      notify("Industry successfully added", { type: "success" });

      // Select the newly created industry.
      onCreate({
        id: newIndustry.value,
        name: newIndustry.label,
      });
    } catch (error) {
      notify(
        `Failed to create industry: ${error instanceof Error ? error.message : error}`,
        {
          type: "error",
        },
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-lg border bg-background p-5 shadow-xl"
      >
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Add New Industry</h3>

          <p className="text-sm text-muted-foreground">
            Enter a new industry to make it available in your CRM.
          </p>
        </div>

        <input
          autoFocus
          value={industryName}
          onChange={(event) => setIndustryName(event.target.value)}
          placeholder="e.g. Digital Transformation"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={!industryName.trim() || isCreating}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreating ? "Adding…" : "Add Industry"}
          </button>
        </div>
      </form>
    </div>
  );
};
