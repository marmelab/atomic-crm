import {
  RotateCcw,
  Save,
  ArrowRight,
  Building2,
  Tag,
  Briefcase,
  Receipt,
  Bell,
  FileText,
  Zap,
  Bot,
  Palette,
  Shield,
  Car,
} from "lucide-react";
import { Link } from "react-router";
import { EditBase, Form, useInput, useNotify } from "ra-core";
import { useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrayInput } from "@/components/admin/array-input";
import { NumberInput } from "@/components/admin/number-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";
import { cn } from "@/lib/utils";

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

type Section = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
};
type Category = {
  id: string;
  label: string;
  color: string;
  sections: Section[];
};

const CATEGORIES: Category[] = [
  {
    id: "azienda",
    label: "Azienda",
    color: "text-blue-600",
    sections: [
      {
        id: "profilo-aziendale",
        label: "Profilo Aziendale",
        icon: Building2,
        color: "text-blue-600",
      },
      {
        id: "branding",
        label: "Marchio",
        icon: Palette,
        color: "text-purple-600",
      },
      {
        id: "autenticazione",
        label: "Autenticazione",
        icon: Shield,
        color: "text-green-600",
      },
    ],
  },
  {
    id: "catalogo",
    label: "Catalogo",
    color: "text-orange-600",
    sections: [
      { id: "tags", label: "Etichette", icon: Tag, color: "text-orange-600" },
      {
        id: "quote-types",
        label: "Tipi preventivo",
        icon: FileText,
        color: "text-amber-600",
      },
      {
        id: "service-types",
        label: "Tipi servizio",
        icon: Briefcase,
        color: "text-yellow-600",
      },
    ],
  },
  {
    id: "operativo",
    label: "Operativo",
    color: "text-cyan-600",
    sections: [
      {
        id: "operativita",
        label: "Operatività",
        icon: Car,
        color: "text-cyan-600",
      },
      { id: "notes", label: "Note", icon: FileText, color: "text-teal-600" },
      { id: "tasks", label: "Attività", icon: Bell, color: "text-emerald-600" },
      {
        id: "automazioni",
        label: "Automazioni",
        icon: Zap,
        color: "text-yellow-500",
      },
    ],
  },
  {
    id: "avanzate",
    label: "Avanzate",
    color: "text-violet-600",
    sections: [
      { id: "ai", label: "AI", icon: Bot, color: "text-violet-600" },
      {
        id: "fiscale",
        label: "Fiscale",
        icon: Receipt,
        color: "text-rose-600",
      },
    ],
  },
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
      defaultTravelOrigin:
        data.operationalConfig?.defaultTravelOrigin?.trim() || undefined,
    },
    fiscalConfig: data.fiscalConfig,
    aiConfig: data.aiConfig,
    businessProfile: data.businessProfile,
    googleWorkplaceDomain: data.googleWorkplaceDomain,
    disableEmailPasswordAuthentication: data.disableEmailPasswordAuthentication,
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
      googleWorkplaceDomain: config.googleWorkplaceDomain,
      disableEmailPasswordAuthentication:
        config.disableEmailPasswordAuthentication,
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
  const [activeSection, setActiveSection] =
    useState<string>("profilo-aziendale");

  // Track visible section using IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 },
    );

    CATEGORIES.forEach((cat) =>
      cat.sections.forEach((section) => {
        const element = document.getElementById(section.id);
        if (element) observer.observe(element);
      }),
    );

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
    }
  };

  return (
    <div className="flex gap-8 mt-4 pb-40 md:pb-20">
      {/* Left navigation - Professional structured menu */}
      <nav className="hidden md:block w-56 shrink-0">
        <div className="sticky top-4">
          <h1 className="text-xl font-semibold px-3 mb-4">Impostazioni</h1>
          <div className="space-y-4">
            {CATEGORIES.map((category) => (
              <div key={category.id}>
                <h3
                  className={cn(
                    "px-3 text-xs font-semibold uppercase tracking-wider mb-1",
                    category.color,
                  )}
                >
                  {category.label}
                </h3>
                <ul className="space-y-0.5">
                  {category.sections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    return (
                      <li key={section.id}>
                        <button
                          type="button"
                          onClick={() => scrollToSection(section.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-all",
                            isActive
                              ? "bg-primary/10 text-primary font-medium shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isActive ? section.color : "opacity-60",
                            )}
                          />
                          <span>{section.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
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

        {/* Authentication */}
        <Card id="autenticazione">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Autenticazione
            </h2>
            <p className="text-sm text-muted-foreground">
              Configurazione SSO con Google Workspace (opzionale).
            </p>
            <TextInput
              source="googleWorkplaceDomain"
              label="Dominio Google Workspace"
              helperText="Es: example.com - lascia vuoto per disabilitare SSO"
            />
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
            <TextInput
              source="operationalConfig.defaultTravelOrigin"
              label="Luogo di partenza predefinito"
              helperText="Precompilato nel calcolatore tratte km (es. Valguarnera Caropepe (EN), Via Calabria 13)."
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

        {/* Automazioni */}
        <Card id="automazioni">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Automazioni
            </h2>
            <p className="text-sm text-muted-foreground">
              Crea regole automatiche che collegano eventi del CRM (nuovi
              pagamenti, preventivi accettati, progetti avviati) a azioni
              (creazione task, notifiche, aggiornamenti).
            </p>
            <Button asChild variant="outline">
              <Link to="/workflows">
                Gestisci automazioni
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
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

      {/* Sticky save button — z-60 to stay above MobileNavigation (z-50) */}
      <div className="fixed bottom-14 md:bottom-0 left-0 right-0 z-60 border-t bg-background p-4">
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
