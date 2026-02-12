import { Save } from "lucide-react";
import { EditBase, Form, useNotify } from "ra-core";
import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrayInput } from "@/components/admin/array-input";
import { SelectInput } from "@/components/admin/select-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";

import {
  useConfigurationContext,
  useConfigurationUpdater,
} from "../root/ConfigurationContext";
import { genderIconRegistry } from "../root/iconRegistry";
import { type ConfigurationContextValue } from "../root/ConfigurationContext";

const SECTIONS = [
  { id: "branding", label: "Branding" },
  { id: "company-sectors", label: "Company Sectors" },
  { id: "deal-stages", label: "Deal Stages" },
  { id: "deal-categories", label: "Deal Categories" },
  { id: "note-statuses", label: "Note Statuses" },
  { id: "task-types", label: "Task Types" },
  { id: "contact-gender", label: "Contact Gender" },
];

const iconChoices = Object.keys(genderIconRegistry).map((name) => ({
  id: name,
  name,
}));

const splitLines = (text: string): string[] =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

const transformFormValues = (data: Record<string, any>) => ({
  config: {
    title: data.title,
    lightModeLogo: data.lightModeLogo,
    darkModeLogo: data.darkModeLogo,
    companySectors: splitLines(data.companySectors),
    dealCategories: splitLines(data.dealCategories),
    taskTypes: splitLines(data.taskTypes),
    dealStages: data.dealStages,
    dealPipelineStatuses: data.dealPipelineStatuses,
    noteStatuses: data.noteStatuses,
    contactGender: data.contactGender,
  } satisfies ConfigurationContextValue,
});

export const AppConfigPage = () => {
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
      <AppConfigForm />
    </EditBase>
  );
};

AppConfigPage.path = "/app-settings";

const AppConfigForm = () => {
  const config = useConfigurationContext();

  const defaultValues = useMemo(
    () => ({
      title: config.title,
      lightModeLogo: config.lightModeLogo,
      darkModeLogo: config.darkModeLogo,
      companySectors: config.companySectors.join("\n"),
      dealCategories: config.dealCategories.join("\n"),
      taskTypes: config.taskTypes.join("\n"),
      dealStages: config.dealStages,
      dealPipelineStatuses: config.dealPipelineStatuses,
      noteStatuses: config.noteStatuses,
      contactGender: config.contactGender,
    }),
    [config],
  );

  return (
    <Form defaultValues={defaultValues}>
      <AppConfigFormFields />
    </Form>
  );
};

const AppConfigFormFields = () => {
  const {
    watch,
    setValue,
    formState: { isSubmitting },
  } = useFormContext();

  const dealStages = watch("dealStages");
  const dealPipelineStatuses: string[] = watch("dealPipelineStatuses") ?? [];

  return (
    <div className="flex gap-8 mt-8 pb-20">
      {/* Left navigation */}
      <nav className="hidden md:block w-48 shrink-0">
        <div className="sticky top-4 space-y-1">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => {
                document
                  .getElementById(section.id)
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
              className="block w-full text-left px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {section.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 min-w-0 max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold">App Configuration</h1>

        {/* Branding */}
        <Card id="branding">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Branding
            </h2>
            <TextInput source="title" label="App Title" />
            <TextInput source="lightModeLogo" label="Light Mode Logo URL" />
            <TextInput source="darkModeLogo" label="Dark Mode Logo URL" />
          </CardContent>
        </Card>

        {/* Company Sectors */}
        <Card id="company-sectors">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Company Sectors
            </h2>
            <TextInput
              source="companySectors"
              label={false}
              multiline
              rows={8}
              helperText="One sector per line"
            />
          </CardContent>
        </Card>

        {/* Deal Stages */}
        <Card id="deal-stages">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Deal Stages
            </h2>
            <ArrayInput source="dealStages" label={false}>
              <SimpleFormIterator inline disableReordering>
                <TextInput source="value" label={false} placeholder="Value" />
                <TextInput source="label" label={false} placeholder="Label" />
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
            <TextInput
              source="dealCategories"
              label={false}
              multiline
              rows={6}
              helperText="One category per line"
            />
          </CardContent>
        </Card>

        {/* Note Statuses */}
        <Card id="note-statuses">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Note Statuses
            </h2>
            <ArrayInput source="noteStatuses" label={false}>
              <SimpleFormIterator inline disableReordering>
                <TextInput source="value" label={false} placeholder="Value" />
                <TextInput source="label" label={false} placeholder="Label" />
                <TextInput
                  source="color"
                  type="color"
                  label={false}
                  inputClassName="w-16 p-1 h-9"
                />
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
            <TextInput
              source="taskTypes"
              label={false}
              multiline
              rows={6}
              helperText="One type per line"
            />
          </CardContent>
        </Card>

        {/* Contact Gender */}
        <Card id="contact-gender">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Contact Gender Options
            </h2>
            <ArrayInput source="contactGender" label={false}>
              <SimpleFormIterator inline disableReordering>
                <TextInput source="value" label={false} placeholder="Value" />
                <TextInput source="label" label={false} placeholder="Label" />
                <SelectInput
                  source="icon"
                  label={false}
                  choices={iconChoices}
                  className="w-36"
                />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>
      </div>

      {/* Sticky save button */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4">
        <div className="max-w-screen-xl mx-auto flex gap-8 px-4">
          <div className="hidden md:block w-48 shrink-0" />
          <div className="flex-1 min-w-0 max-w-2xl flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              <Save className="h-4 w-4 mr-1" />
              {isSubmitting ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
