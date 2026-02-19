import { RotateCcw, Save } from "lucide-react";
import { EditBase, Form, useGetList, useInput, useNotify } from "ra-core";
import { useCallback, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";

import ImageEditorField from "../misc/ImageEditorField";
import {
  useConfigurationContext,
  useConfigurationUpdater,
  type ConfigurationContextValue,
} from "../root/ConfigurationContext";
import { defaultConfiguration } from "../root/defaultConfiguration";

const SECTIONS = [
  { id: "branding", label: "Branding" },
  { id: "company-sectors", label: "Company Sectors" },
  { id: "deal-stages", label: "Deal Stages" },
  { id: "deal-categories", label: "Deal Categories" },
  { id: "note-statuses", label: "Note Statuses" },
  { id: "task-types", label: "Task Types" },
];

/**
 * Derive a stable slug value from a display label.
 * e.g. "Communication Services" → "communication-services"
 */
const toSlug = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Ensure every item in a { value, label } array has a value (slug from label). */
const ensureValues = (items: { value?: string; label: string }[] | undefined) =>
  items?.map((item) => ({ ...item, value: item.value || toSlug(item.label) }));

const transformFormValues = (data: Record<string, any>) => ({
  config: {
    title: data.title,
    lightModeLogo: data.lightModeLogo,
    darkModeLogo: data.darkModeLogo,
    companySectors: ensureValues(data.companySectors),
    dealCategories: ensureValues(data.dealCategories),
    taskTypes: ensureValues(data.taskTypes),
    dealStages: ensureValues(data.dealStages),
    dealPipelineStatuses: data.dealPipelineStatuses,
    noteStatuses: ensureValues(data.noteStatuses),
  } as ConfigurationContextValue,
});

export const SettingsPage = () => {
  const updateConfiguration = useConfigurationUpdater();
  const notify = useNotify();

  return (
    <EditBase
      resource="configuration"
      id={1}
      mutationMode="pessimistic"
      redirect={false}
      transform={transformFormValues}
      mutationOptions={{
        onSuccess: (data: any) => {
          updateConfiguration(data.config);
          notify("Configuration saved successfully");
        },
        onError: () => {
          notify("Failed to save configuration", { type: "error" });
        },
      }}
    >
      <SettingsForm />
    </EditBase>
  );
};

SettingsPage.path = "/settings";

const SettingsForm = () => {
  const config = useConfigurationContext();

  const defaultValues = useMemo(
    () => ({
      title: config.title,
      lightModeLogo: { src: config.lightModeLogo },
      darkModeLogo: { src: config.darkModeLogo },
      companySectors: config.companySectors,
      dealCategories: config.dealCategories,
      taskTypes: config.taskTypes,
      dealStages: config.dealStages,
      dealPipelineStatuses: config.dealPipelineStatuses,
      noteStatuses: config.noteStatuses,
    }),
    [config],
  );

  return (
    <Form defaultValues={defaultValues}>
      <SettingsFormFields />
    </Form>
  );
};

const SettingsFormFields = () => {
  const {
    watch,
    setValue,
    reset,
    formState: { isSubmitting },
  } = useFormContext();

  const dealStages = watch("dealStages");
  const dealPipelineStatuses: string[] = watch("dealPipelineStatuses") ?? [];

  const { data: deals } = useGetList("deals", {
    pagination: { page: 1, perPage: 1000 },
  });

  const validateDealStages = useCallback(
    (stages: { value: string; label: string }[] | undefined) => {
      if (!deals || !stages) return undefined;
      const stageValues = new Set(
        stages.map((s) => s.value || toSlug(s.label)),
      );
      const inUse = deals
        .filter((deal) => deal.stage && !stageValues.has(deal.stage))
        .map((deal) => deal.stage);
      const uniqueInUse = [...new Set(inUse)];
      if (uniqueInUse.length > 0) {
        return `Cannot remove stages that are still used by deals: ${uniqueInUse.join(", ")}`;
      }
      return undefined;
    },
    [deals],
  );

  const validateDealCategories = useCallback(
    (categories: { value: string; label: string }[] | undefined) => {
      if (!deals || !categories) return undefined;
      const categoryValues = new Set(
        categories.map((c) => c.value || toSlug(c.label)),
      );
      const inUse = deals
        .filter((deal) => deal.category && !categoryValues.has(deal.category))
        .map((deal) => deal.category);
      const uniqueInUse = [...new Set(inUse)];
      if (uniqueInUse.length > 0) {
        return `Cannot remove categories that are still used by deals: ${uniqueInUse.join(", ")}`;
      }
      return undefined;
    },
    [deals],
  );

  return (
    <div className="flex gap-8 mt-4 pb-20">
      {/* Left navigation */}
      <nav className="hidden md:block w-48 shrink-0">
        <div className="sticky top-4 space-y-1">
          <h1 className="text-2xl font-semibold px-3 mb-2">Settings</h1>
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
              {section.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 min-w-0 max-w-2xl space-y-6">
        {/* Branding */}
        <Card id="branding">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Branding
            </h2>
            <TextInput source="title" label="App Title" />
            <div className="flex gap-8">
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">Light Mode Logo</p>
                <ImageEditorField
                  source="lightModeLogo"
                  width={100}
                  height={100}
                  linkPosition="bottom"
                  backgroundImageColor="#f5f5f5"
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">Dark Mode Logo</p>
                <ImageEditorField
                  source="darkModeLogo"
                  width={100}
                  height={100}
                  linkPosition="bottom"
                  backgroundImageColor="#1a1a1a"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Sectors */}
        <Card id="company-sectors">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Company Sectors
            </h2>
            <ArrayInput
              source="companySectors"
              label={false}
              helperText={false}
            >
              <SimpleFormIterator disableReordering disableClear>
                <TextInput source="label" label={false} />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>

        {/* Deal Stages */}
        <Card id="deal-stages">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Deal Stages
            </h2>
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
              Pipeline Statuses
            </h3>
            <p className="text-sm text-muted-foreground">
              Select which deal stages count as &quot;pipeline&quot; (completed)
              deals.
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
                            dealPipelineStatuses.filter(
                              (s) => s !== stage.value,
                            ),
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
          </CardContent>
        </Card>

        {/* Deal Categories */}
        <Card id="deal-categories">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Deal Categories
            </h2>
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
          </CardContent>
        </Card>

        {/* Note Statuses */}
        <Card id="note-statuses">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Note Statuses
            </h2>
            <ArrayInput source="noteStatuses" label={false} helperText={false}>
              <SimpleFormIterator inline disableReordering disableClear>
                <TextInput source="label" label={false} className="flex-1" />
                <ColorInput source="color" />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>

        {/* Task Types */}
        <Card id="task-types">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Task Types
            </h2>
            <ArrayInput source="taskTypes" label={false} helperText={false}>
              <SimpleFormIterator disableReordering disableClear>
                <TextInput source="label" label={false} />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>
      </div>

      {/* Sticky save button */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4">
        <div className="max-w-screen-xl mx-auto flex gap-8 px-4">
          <div className="hidden md:block w-48 shrink-0" />
          <div className="flex-1 min-w-0 max-w-2xl flex justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                reset({
                  ...defaultConfiguration,
                  lightModeLogo: {
                    src: defaultConfiguration.lightModeLogo,
                  },
                  darkModeLogo: { src: defaultConfiguration.darkModeLogo },
                })
              }
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset to Defaults
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-1" />
                {isSubmitting ? "Saving..." : "Save Configuration"}
              </Button>
            </div>
          </div>
        </div>
      </div>
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
