/* eslint-disable react-refresh/only-export-components */
import { RotateCcw, Save, Upload } from "lucide-react";
import type { RaRecord } from "ra-core";
import { useGetList, useInput, useTranslate } from "ra-core";
import { useCallback, useMemo } from "react";
import { useFormContext } from "react-hook-form";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toSlug } from "@/lib/toSlug";

import { ArrayInput } from "@/components/admin/array-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { NumberInput } from "@/components/admin/number-input";
import { SelectInput } from "@/components/admin/select-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";

import ImageEditorField from "../misc/ImageEditorField";
import type { ConfigurationContextValue } from "../root/ConfigurationContext";
import { defaultConfiguration } from "../root/defaultConfiguration";

const SECTIONS = [
  {
    id: "branding",
    label: "crm.settings.sections.branding",
    fallback: "Branding",
  },
  {
    id: "seller-company",
    label: "crm.settings.sections.seller_company",
    fallback: "Company Info",
  },
  {
    id: "proposal-automation",
    label: "crm.settings.sections.proposal_automation",
    fallback: "Proposal Automation",
  },
  {
    id: "companies",
    label: "resources.companies.name",
    fallback: "Companies",
  },
  { id: "deals", label: "resources.deals.name", fallback: "Deals" },
  { id: "notes", label: "resources.notes.name", fallback: "Notes" },
  { id: "tasks", label: "resources.tasks.name", fallback: "Tasks" },
  {
    id: "revenue-goals",
    label: "crm.settings.sections.revenue_goals",
    fallback: "Revenue Goals",
  },
  {
    id: "monthly-report",
    label: "crm.settings.sections.monthly_report",
    fallback: "Månadsrapport",
  },
] as const;

/** Ensure every item in a { value, label } array has a value (slug from label). */
export const ensureValues = (
  items: { value?: string; label: string }[] | undefined,
) =>
  items?.map((item) => ({ ...item, value: item.value || toSlug(item.label) }));

type ValidateItemsInUseMessages = {
  duplicate?: (displayName: string, duplicates: string[]) => string;
  inUse?: (displayName: string, inUse: string[]) => string;
  validating?: string;
};

/**
 * Validate that no items were removed if they are still referenced by existing deals.
 * Also rejects duplicate slug values.
 * Returns undefined if valid, or an error message string.
 */
export const validateItemsInUse = (
  items: { value: string; label: string }[] | undefined,
  deals: RaRecord[] | undefined,
  fieldName: string,
  displayName: string,
  messages?: ValidateItemsInUseMessages,
) => {
  if (!items) return undefined;
  // Check for duplicate slugs
  const slugs = items.map((i) => i.value || toSlug(i.label));
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const slug of slugs) {
    if (seen.has(slug)) duplicates.add(slug);
    seen.add(slug);
  }
  if (duplicates.size > 0) {
    const duplicatesList = [...duplicates];
    return (
      messages?.duplicate?.(displayName, duplicatesList) ??
      `Duplicate ${displayName}: ${duplicatesList.join(", ")}`
    );
  }
  // Check that no in-use value was removed (skip if deals haven't loaded)
  if (!deals) return messages?.validating ?? "Validating…";
  const values = new Set(slugs);
  const inUse = [
    ...new Set(
      deals
        .filter(
          (deal) => deal[fieldName] && !values.has(deal[fieldName] as string),
        )
        .map((deal) => deal[fieldName] as string),
    ),
  ];
  if (inUse.length > 0) {
    return (
      messages?.inUse?.(displayName, inUse) ??
      `Cannot remove ${displayName} that are still used by deals: ${inUse.join(", ")}`
    );
  }
  return undefined;
};

const getCurrencyChoices = () => {
  const displayNames = new Intl.DisplayNames(
    typeof navigator !== "undefined"
      ? (navigator.languages as string[])
      : ["en"],
    { type: "currency" },
  );
  return Intl.supportedValuesOf("currency").map((code) => ({
    id: code,
    name: `${code} – ${displayNames.of(code)}`,
  }));
};

export const transformSettingsFormValues = (data: Record<string, any>) => ({
  config: {
    title: data.title,
    lightModeLogo: data.lightModeLogo,
    darkModeLogo: data.darkModeLogo,
    currency: data.currency,
    companySectors: ensureValues(data.companySectors),
    dealCategories: ensureValues(data.dealCategories),
    taskTypes: ensureValues(data.taskTypes),
    dealStages: ensureValues(data.dealStages),
    dealPipelineStatuses: data.dealPipelineStatuses,
    noteStatuses: ensureValues(data.noteStatuses),
    sellerCompany: data.sellerCompany,
    proposalKbTemplate: data.proposalKbTemplate,
    revenueGoals: (data.revenueGoals ?? []).map((g: Record<string, any>) => ({
      label: g.label ?? "",
      amount: Number(g.amount) || 0,
      period: g.period ?? "monthly",
    })),
    monthlyReport: {
      upsellCatalog: (data.monthlyReport?.upsellCatalog ?? []).map(
        (o: Record<string, any>) => ({
          service: o.service ?? "",
          label: o.label ?? "",
          description: o.description ?? "",
          pitch: o.pitch ?? "",
        }),
      ),
    },
  } as ConfigurationContextValue,
});

/* ──────────────────────────────── Section components ──────────────────────────────── */

const BrandingFields = () => {
  const translate = useTranslate();
  return (
    <>
      <TextInput source="title" label="crm.settings.app_title" />
      <div className="flex flex-wrap gap-8">
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm text-muted-foreground">
            {translate("crm.settings.light_mode_logo")}
          </p>
          <ImageEditorField
            source="lightModeLogo"
            width={100}
            height={100}
            linkPosition="bottom"
            backgroundImageColor="#f5f5f5"
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-sm text-muted-foreground">
            {translate("crm.settings.dark_mode_logo")}
          </p>
          <ImageEditorField
            source="darkModeLogo"
            width={100}
            height={100}
            linkPosition="bottom"
            backgroundImageColor="#1a1a1a"
          />
        </div>
      </div>
    </>
  );
};

const SellerCompanyFields = () => {
  const translate = useTranslate();
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {translate("crm.settings.seller_company.description", {
          _: "Your company details shown on quotes and invoices.",
        })}
      </p>

      <h3 className="text-lg font-medium text-muted-foreground">
        {translate("crm.settings.seller_company.basic_info", {
          _: "Basic Information",
        })}
      </h3>
      <TextInput
        source="sellerCompany.companyName"
        label="crm.settings.seller_company.company_name"
        helperText={false}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          source="sellerCompany.orgNumber"
          label="crm.settings.seller_company.org_number"
          helperText={false}
        />
        <TextInput
          source="sellerCompany.vatNumber"
          label="crm.settings.seller_company.vat_number"
          helperText={false}
        />
      </div>
      <BooleanInput
        source="sellerCompany.fSkatt"
        label="crm.settings.seller_company.f_skatt"
      />

      <Separator />

      <h3 className="text-lg font-medium text-muted-foreground">
        {translate("crm.settings.seller_company.address_heading", {
          _: "Address",
        })}
      </h3>
      <TextInput
        source="sellerCompany.address"
        label="crm.settings.seller_company.address"
        helperText={false}
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TextInput
          source="sellerCompany.zipcode"
          label="crm.settings.seller_company.zipcode"
          helperText={false}
        />
        <TextInput
          source="sellerCompany.city"
          label="crm.settings.seller_company.city"
          helperText={false}
        />
        <TextInput
          source="sellerCompany.country"
          label="crm.settings.seller_company.country"
          helperText={false}
        />
      </div>

      <Separator />

      <h3 className="text-lg font-medium text-muted-foreground">
        {translate("crm.settings.seller_company.contact_heading", {
          _: "Contact",
        })}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          source="sellerCompany.phone"
          label="crm.settings.seller_company.phone"
          helperText={false}
        />
        <TextInput
          source="sellerCompany.email"
          label="crm.settings.seller_company.email"
          helperText={false}
        />
      </div>
      <TextInput
        source="sellerCompany.website"
        label="crm.settings.seller_company.website"
        helperText={false}
      />

      <Separator />

      <h3 className="text-lg font-medium text-muted-foreground">
        {translate("crm.settings.seller_company.bank_heading", {
          _: "Bank Details",
        })}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          source="sellerCompany.bankgiro"
          label="crm.settings.seller_company.bankgiro"
          helperText={false}
        />
        <TextInput
          source="sellerCompany.plusgiro"
          label="crm.settings.seller_company.plusgiro"
          helperText={false}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInput
          source="sellerCompany.iban"
          label="crm.settings.seller_company.iban"
          helperText={false}
        />
        <TextInput
          source="sellerCompany.bic"
          label="crm.settings.seller_company.bic"
          helperText={false}
        />
      </div>

      <Separator />

      <h3 className="text-lg font-medium text-muted-foreground">
        {translate("crm.settings.seller_company.defaults_heading", {
          _: "Default Quote Terms",
        })}
      </h3>
      <TextInput
        source="sellerCompany.defaultPaymentTerms"
        label="crm.settings.seller_company.payment_terms"
        helperText={false}
      />
      <TextInput
        source="sellerCompany.defaultDeliveryTerms"
        label="crm.settings.seller_company.delivery_terms"
        helperText={false}
      />
      <TextAreaInput
        source="sellerCompany.defaultTermsAndConditions"
        label="crm.settings.seller_company.terms_and_conditions"
        allowFileUpload
      />

      <h3 className="text-lg font-medium text-muted-foreground">
        {translate("crm.settings.seller_company.quote_logo_heading", {
          _: "Quote Branding",
        })}
      </h3>
      <p className="text-sm text-muted-foreground">
        {translate("crm.settings.seller_company.quote_logo_description", {
          _: "Logo shown on quotes (recommended: light background)",
        })}
      </p>
      <div className="flex flex-col items-center gap-1">
        <ImageEditorField
          source="sellerCompany.quoteLogo"
          width={120}
          height={60}
          linkPosition="bottom"
          backgroundImageColor="#f5f5f5"
        />
      </div>
    </>
  );
};

const ProposalAutomationFields = () => {
  const translate = useTranslate();
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {translate("crm.settings.proposal_automation.description", {
          _: 'When a deal is moved to "Generating Proposal", the system automatically creates a quote, generates AI text, builds a PDF, and posts to Discord for approval. The KB template below is used as a style and structure reference for the AI.',
        })}
      </p>

      <h3 className="text-lg font-medium text-muted-foreground">
        {translate("crm.settings.proposal_automation.kb_template_heading", {
          _: "Best Proposal Reference (KB Template)",
        })}
      </h3>
      <p className="text-sm text-muted-foreground">
        {translate("crm.settings.proposal_automation.kb_template_help", {
          _: "Paste your single best proposal ever written. The AI uses this as a reference for tone, structure, and level of detail. This is NOT a template with blanks — it should be a complete, real proposal.",
        })}
      </p>
      <TextAreaInput
        source="proposalKbTemplate"
        label="crm.settings.proposal_automation.kb_template"
        allowFileUpload
      />
    </>
  );
};

const CompaniesFields = () => {
  const translate = useTranslate();
  return (
    <>
      <h3 className="text-lg font-medium text-muted-foreground">
        {translate("crm.settings.companies.sectors")}
      </h3>
      <ArrayInput source="companySectors" label={false} helperText={false}>
        <SimpleFormIterator disableReordering disableClear>
          <TextInput source="label" label={false} />
        </SimpleFormIterator>
      </ArrayInput>
    </>
  );
};

const DealsFields = () => {
  const translate = useTranslate();
  const currencyChoices = useMemo(() => getCurrencyChoices(), []);
  const { watch, setValue } = useFormContext();
  const dealStages = watch("dealStages");
  const dealPipelineStatuses: string[] = watch("dealPipelineStatuses") ?? [];

  const stageDisplayName = translate("crm.settings.validation.entities.stages");
  const categoryDisplayName = translate(
    "crm.settings.validation.entities.categories",
  );

  const { data: deals } = useGetList("deals", {
    pagination: { page: 1, perPage: 1000 },
  });

  const validateDealStages = useCallback(
    (stages: { value: string; label: string }[] | undefined) =>
      validateItemsInUse(stages, deals, "stage", stageDisplayName, {
        duplicate: (displayName, duplicates) =>
          translate("crm.settings.validation.duplicate", {
            display_name: displayName,
            items: duplicates.join(", "),
          }),
        inUse: (displayName, inUse) =>
          translate("crm.settings.validation.in_use", {
            display_name: displayName,
            items: inUse.join(", "),
          }),
        validating: translate("crm.settings.validation.validating"),
      }),
    [deals, stageDisplayName, translate],
  );

  const validateDealCategories = useCallback(
    (categories: { value: string; label: string }[] | undefined) =>
      validateItemsInUse(categories, deals, "category", categoryDisplayName, {
        duplicate: (displayName, duplicates) =>
          translate("crm.settings.validation.duplicate", {
            display_name: displayName,
            items: duplicates.join(", "),
          }),
        inUse: (displayName, inUse) =>
          translate("crm.settings.validation.in_use", {
            display_name: displayName,
            items: inUse.join(", "),
          }),
        validating: translate("crm.settings.validation.validating"),
      }),
    [categoryDisplayName, deals, translate],
  );

  return (
    <>
      <h3 className="text-lg font-medium text-muted-foreground">
        {translate("crm.settings.deals.currency")}
      </h3>
      <AutocompleteInput
        source="currency"
        label={false}
        choices={currencyChoices}
        inputText={(choice) => choice?.id}
        modal
      />

      <Separator />

      <h3 className="text-lg font-medium text-muted-foreground">
        {translate("crm.settings.deals.stages")}
      </h3>
      <ArrayInput
        source="dealStages"
        label={false}
        helperText={false}
        validate={validateDealStages}
      >
        <SimpleFormIterator disableClear>
          <TextInput source="label" label={false} />
        </SimpleFormIterator>
      </ArrayInput>

      <Separator />

      <h3 className="text-lg font-medium text-muted-foreground">
        {translate("crm.settings.deals.pipeline_statuses")}
      </h3>
      <p className="text-sm text-muted-foreground">
        {translate("crm.settings.deals.pipeline_help")}
      </p>
      <div className="flex flex-wrap gap-2">
        {dealStages?.map(
          (stage: { value: string; label: string }, idx: number) => {
            const isSelected = dealPipelineStatuses.includes(stage.value);
            return (
              <Button
                key={idx}
                type="button"
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (isSelected) {
                    setValue(
                      "dealPipelineStatuses",
                      dealPipelineStatuses.filter((s) => s !== stage.value),
                    );
                  } else {
                    setValue("dealPipelineStatuses", [
                      ...dealPipelineStatuses,
                      stage.value,
                    ]);
                  }
                }}
              >
                {stage.label || stage.value}
              </Button>
            );
          },
        )}
      </div>

      <Separator />

      <h3 className="text-lg font-medium text-muted-foreground">
        {translate("crm.settings.deals.categories")}
      </h3>
      <ArrayInput
        source="dealCategories"
        label={false}
        helperText={false}
        validate={validateDealCategories}
      >
        <SimpleFormIterator disableReordering disableClear>
          <TextInput source="label" label={false} />
        </SimpleFormIterator>
      </ArrayInput>
    </>
  );
};

const NotesFields = () => {
  const translate = useTranslate();
  return (
    <>
      <h3 className="text-lg font-medium text-muted-foreground">
        {translate("crm.settings.notes.statuses")}
      </h3>
      <ArrayInput source="noteStatuses" label={false} helperText={false}>
        <SimpleFormIterator inline disableReordering disableClear>
          <TextInput source="label" label={false} className="flex-1" />
          <ColorInput source="color" />
        </SimpleFormIterator>
      </ArrayInput>
    </>
  );
};

const TasksFields = () => {
  const translate = useTranslate();
  return (
    <>
      <h3 className="text-lg font-medium text-muted-foreground">
        {translate("crm.settings.tasks.types")}
      </h3>
      <ArrayInput source="taskTypes" label={false} helperText={false}>
        <SimpleFormIterator disableReordering disableClear>
          <TextInput source="label" label={false} />
        </SimpleFormIterator>
      </ArrayInput>
    </>
  );
};

const RevenueGoalsFields = () => {
  const translate = useTranslate();
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {translate("crm.settings.revenue_goals.description", {
          _: "Set revenue targets to track in your dashboard. Add goals for different time periods.",
        })}
      </p>
      <ArrayInput source="revenueGoals" label={false} helperText={false}>
        <SimpleFormIterator inline disableReordering disableClear>
          <TextInput
            source="label"
            label={translate("crm.settings.revenue_goals.label", {
              _: "Goal Name",
            })}
            className="flex-1"
          />
          <NumberInput
            source="amount"
            label={translate("crm.settings.revenue_goals.amount", {
              _: "Target Amount",
            })}
            min={0}
          />
          <SelectInput
            source="period"
            label={translate("crm.settings.revenue_goals.period", {
              _: "Period",
            })}
            choices={[
              {
                id: "weekly",
                name: translate("crm.settings.revenue_goals.weekly", {
                  _: "Weekly",
                }),
              },
              {
                id: "monthly",
                name: translate("crm.settings.revenue_goals.monthly", {
                  _: "Monthly",
                }),
              },
              {
                id: "quarterly",
                name: translate("crm.settings.revenue_goals.quarterly", {
                  _: "Quarterly",
                }),
              },
              {
                id: "yearly",
                name: translate("crm.settings.revenue_goals.yearly", {
                  _: "Yearly",
                }),
              },
            ]}
            defaultValue="monthly"
          />
        </SimpleFormIterator>
      </ArrayInput>
    </>
  );
};

const MonthlyReportFields = () => {
  const translate = useTranslate();
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {translate("crm.settings.monthly_report.description", {
          _: "Upsell-katalogen styr vilka tjänster månadsrapporten föreslår. 'Tjänst' måste matcha bristanalysens tjänstenamn exakt (t.ex. SEO-optimering, Google Business-paket). Inga priser — pris tas i dialog.",
        })}
      </p>
      <ArrayInput
        source="monthlyReport.upsellCatalog"
        label={false}
        helperText={false}
      >
        <SimpleFormIterator disableReordering>
          <TextInput source="service" label="Tjänst (matchar brist)" />
          <TextInput source="label" label="Rubrik" />
          <TextAreaInput source="description" label="Behov (kundvänd mening)" />
          <TextAreaInput source="pitch" label="Pitch-vinkel" />
        </SimpleFormIterator>
      </ArrayInput>
    </>
  );
};

const SECTION_COMPONENTS: Record<
  (typeof SECTIONS)[number]["id"],
  () => React.JSX.Element
> = {
  branding: BrandingFields,
  "seller-company": SellerCompanyFields,
  "proposal-automation": ProposalAutomationFields,
  companies: CompaniesFields,
  deals: DealsFields,
  notes: NotesFields,
  tasks: TasksFields,
  "revenue-goals": RevenueGoalsFields,
  "monthly-report": MonthlyReportFields,
};

/* ──────────────────────────────── Layouts ──────────────────────────────── */

type Variant = "desktop" | "mobile";

export const SettingsFormFields = ({
  variant = "desktop",
}: {
  variant?: Variant;
}) => {
  const translate = useTranslate();
  const {
    reset,
    formState: { isSubmitting },
  } = useFormContext();

  const handleReset = useCallback(() => {
    reset({
      ...defaultConfiguration,
      lightModeLogo: { src: defaultConfiguration.lightModeLogo },
      darkModeLogo: { src: defaultConfiguration.darkModeLogo },
    });
  }, [reset]);

  if (variant === "mobile") {
    return (
      <div className="flex flex-col pb-[calc(var(--crm-mobile-nav-height)+6rem)]">
        <Accordion type="multiple" className="w-full">
          {SECTIONS.map((section) => {
            const SectionFields = SECTION_COMPONENTS[section.id];
            return (
              <AccordionItem key={section.id} value={section.id}>
                <AccordionTrigger className="text-base font-medium">
                  {translate(section.label, {
                    smart_count: 2,
                    _: section.fallback,
                  })}
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2 pb-4">
                  <SectionFields />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Sticky save bar */}
        <div
          className="fixed left-0 right-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/90"
          style={{ bottom: "var(--crm-mobile-nav-height)" }}
        >
          <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              {translate("crm.settings.reset_defaults")}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="shrink-0">
              <Save className="h-4 w-4 mr-1" />
              {isSubmitting
                ? translate("crm.settings.saving")
                : translate("ra.action.save")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop layout — left nav + Cards
  return (
    <div className="flex gap-8 mt-4 pb-20">
      {/* Left navigation */}
      <nav className="hidden md:block w-48 shrink-0">
        <div className="sticky top-4 space-y-1">
          <h1 className="text-2xl font-semibold px-3 mb-2">
            {translate("crm.settings.title")}
          </h1>
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => {
                document
                  .getElementById(section.id)
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="block w-full text-left px-3 py-1 text-sm rounded-md hover:text-foreground hover:bg-muted transition-colors"
            >
              {translate(section.label, { smart_count: 2 })}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 min-w-0 max-w-2xl space-y-6">
        {SECTIONS.map((section) => {
          const SectionFields = SECTION_COMPONENTS[section.id];
          return (
            <Card key={section.id} id={section.id}>
              <CardContent className="space-y-4">
                <h2 className="text-xl font-semibold text-muted-foreground">
                  {translate(section.label, {
                    smart_count: 2,
                    _: section.fallback,
                  })}
                </h2>
                <SectionFields />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Sticky save button */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4">
        <div className="max-w-screen-xl mx-auto flex gap-8 px-4">
          <div className="hidden md:block w-48 shrink-0" />
          <div className="flex-1 min-w-0 max-w-2xl flex justify-between">
            <Button type="button" variant="ghost" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-1" />
              {translate("crm.settings.reset_defaults")}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
              >
                {translate("ra.action.cancel")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-1" />
                {isSubmitting
                  ? translate("crm.settings.saving")
                  : translate("ra.action.save")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ──────────────────────────────── Helper inputs ──────────────────────────────── */

/** A minimal textarea input compatible with ra-core's useInput, with optional file upload. */
const TextAreaInput = ({
  source,
  label,
  allowFileUpload,
}: {
  source: string;
  label: string;
  allowFileUpload?: boolean;
}) => {
  const { field } = useInput({ source });
  const translate = useTranslate();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === "string") {
        field.onChange(text);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-muted-foreground">
          {translate(label, { _: label })}
        </label>
        {allowFileUpload && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            onClick={() =>
              document.getElementById(`file-upload-${source}`)?.click()
            }
          >
            <Upload className="w-3.5 h-3.5 mr-1" />
            {translate("crm.settings.seller_company.load_from_file", {
              _: "Load from file",
            })}
          </Button>
        )}
      </div>
      <Textarea
        {...field}
        value={field.value || ""}
        rows={6}
        className="resize-y"
      />
      {allowFileUpload && (
        <input
          id={`file-upload-${source}`}
          type="file"
          accept=".txt,.md"
          className="hidden"
          onChange={handleFileUpload}
        />
      )}
    </div>
  );
};

/** A minimal color picker input compatible with ra-core's useInput. */
const ColorInput = ({ source }: { source: string }) => {
  const { field } = useInput({ source });
  return (
    <input
      type="color"
      {...field}
      value={field.value || "#000000"}
      className="w-9 h-9 shrink-0 cursor-pointer appearance-none rounded border bg-transparent p-0.5 [&::-webkit-color-swatch-wrapper]:cursor-pointer [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:cursor-pointer [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-none [&::-moz-color-swatch]:cursor-pointer [&::-moz-color-swatch]:rounded-sm [&::-moz-color-swatch]:border-none"
    />
  );
};
