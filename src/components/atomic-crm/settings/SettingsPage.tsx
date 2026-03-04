import { RotateCcw, Save } from "lucide-react";
import { EditBase, Form, useInput, useNotify } from "ra-core";
import { useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrayInput } from "@/components/admin/array-input";
import { NumberInput } from "@/components/admin/number-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";

import ImageEditorField from "../misc/ImageEditorField";
import {
  useConfigurationContext,
  useConfigurationUpdater,
  type ConfigurationContextValue,
} from "../root/ConfigurationContext";
import { defaultConfiguration } from "../root/defaultConfiguration";
import { AISettingsSection } from "./AISettingsSection";
import { BusinessProfileSettingsSection } from "./BusinessProfileSettingsSection";
import { FiscalSettingsSection } from "./FiscalSettingsSection";
import { TagsSettingsSection } from "./TagsSettingsSection";

const SECTIONS = [
  { id: "profilo-aziendale", label: "Profilo Aziendale" },
  { id: "branding", label: "Marchio" },
  { id: "tags", label: "Etichette" },
  { id: "quote-types", label: "Tipi preventivo" },
  { id: "service-types", label: "Tipi servizio" },
  { id: "operativita", label: "Operatività" },
  { id: "notes", label: "Note" },
  { id: "tasks", label: "Attività" },
  { id: "ai", label: "AI" },
  { id: "fiscale", label: "Fiscale" },
];

const transformFormValues = (data: Record<string, any>) => ({
  config: {
    title: data.title,
    lightModeLogo: data.lightModeLogo,
    darkModeLogo: data.darkModeLogo,
    taskTypes: ensureValues(data.taskTypes),
    noteStatuses: ensureValues(data.noteStatuses),
    quoteServiceTypes: ensureValues(data.quoteServiceTypes),
    serviceTypeChoices: ensureValues(data.serviceTypeChoices),
    operationalConfig: {
      defaultKmRate:
        Number(data.operationalConfig?.defaultKmRate) ||
        defaultConfiguration.operationalConfig.defaultKmRate,
    },
    fiscalConfig: data.fiscalConfig,
    aiConfig: data.aiConfig,
    businessProfile: data.businessProfile,
  } as ConfigurationContextValue,
});

/** Ensure every item in a { value, label } array has a value (slug from label). */
const ensureValues = (
  items: { value?: string; label: string; description?: string }[] | undefined,
) =>
  items?.map((item) => ({
    ...item,
    value: item.value || toSlug(item.label),
  }));

const toSlug = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

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
          notify("Configurazione salvata con successo");
        },
        onError: () => {
          notify("Errore nel salvataggio della configurazione", {
            type: "error",
          });
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
      taskTypes: config.taskTypes,
      noteStatuses: config.noteStatuses,
      quoteServiceTypes: config.quoteServiceTypes,
      serviceTypeChoices: config.serviceTypeChoices,
      operationalConfig: config.operationalConfig,
      fiscalConfig: config.fiscalConfig,
      aiConfig: config.aiConfig,
      businessProfile: config.businessProfile,
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
    reset,
    formState: { isSubmitting },
  } = useFormContext();

  return (
    <div className="flex gap-8 mt-4 pb-20">
      {/* Left navigation */}
      <nav className="hidden md:block w-48 shrink-0">
        <div className="sticky top-4 space-y-1">
          <h1 className="text-2xl font-semibold px-3 mb-2">Impostazioni</h1>
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
        {/* Business Profile */}
        <Card id="profilo-aziendale">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Profilo Aziendale
            </h2>
            <BusinessProfileSettingsSection />
          </CardContent>
        </Card>

        {/* Branding */}
        <Card id="branding">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Marchio
            </h2>
            <TextInput source="title" label="Titolo App" />
            <div className="flex gap-8">
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">
                  Logo Modalità Chiara
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
                  Logo Modalità Scura
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
          </CardContent>
        </Card>

        {/* Tags */}
        <Card id="tags">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Etichette
            </h2>
            <TagsSettingsSection />
          </CardContent>
        </Card>

        {/* Quote service types */}
        <Card id="quote-types">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Tipi preventivo
            </h2>
            <p className="text-sm text-muted-foreground">
              Categorie di lavoro proposte al cliente (es. Wedding, Produzione
              TV, Spot).
            </p>
            <ArrayInput
              source="quoteServiceTypes"
              label={false}
              helperText={false}
            >
              <SimpleFormIterator disableReordering disableClear>
                <TextInput source="label" label={false} />
                <TextInput
                  source="description"
                  label={false}
                  multiline
                  helperText="Spiega quando usare questo tipo nei preventivi."
                />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>

        {/* Service type choices */}
        <Card id="service-types">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Tipi servizio
            </h2>
            <p className="text-sm text-muted-foreground">
              Tipi di prestazione nel registro lavori (es. Riprese, Montaggio,
              Fotografia).
            </p>
            <ArrayInput
              source="serviceTypeChoices"
              label={false}
              helperText={false}
            >
              <SimpleFormIterator disableReordering disableClear>
                <TextInput source="label" label={false} />
                <TextInput
                  source="description"
                  label={false}
                  multiline
                  helperText="Spiega quando questo tipo va usato nel registro lavori."
                />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>

        <Card id="operativita">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Operatività
            </h2>
            <p className="text-sm text-muted-foreground">
              Regole base condivise da servizi, spese e future automazioni AI.
            </p>
            <NumberInput
              source="operationalConfig.defaultKmRate"
              label="Tariffa km predefinita (EUR)"
              helperText="Usata come valore iniziale per rimborso km in servizi e spese."
            />
          </CardContent>
        </Card>

        {/* Notes */}
        <Card id="notes">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Note
            </h2>
            <h3 className="text-lg font-medium text-muted-foreground">Stati</h3>
            <ArrayInput source="noteStatuses" label={false} helperText={false}>
              <SimpleFormIterator inline disableReordering disableClear>
                <TextInput source="label" label={false} className="flex-1" />
                <ColorInput source="color" />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>

        {/* Tasks */}
        <Card id="tasks">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Attività
            </h2>
            <h3 className="text-lg font-medium text-muted-foreground">Tipi</h3>
            <ArrayInput source="taskTypes" label={false} helperText={false}>
              <SimpleFormIterator disableReordering disableClear>
                <TextInput source="label" label={false} />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>

        {/* AI */}
        <Card id="ai">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">AI</h2>
            <AISettingsSection />
          </CardContent>
        </Card>

        {/* Fiscal */}
        <Card id="fiscale">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Fiscale
            </h2>
            <FiscalSettingsSection />
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
              Ripristina Predefiniti
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
              >
                Annulla
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-1" />
                {isSubmitting ? "Salvataggio..." : "Salva"}
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
