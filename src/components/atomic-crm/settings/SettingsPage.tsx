import {
  ChevronDown,
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
import { useCallback, useEffect, useMemo, useState } from "react";
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

  // Show save bar when scrolling up, hide when scrolling down
  const [saveBarVisible, setSaveBarVisible] = useState(true);
  useEffect(() => {
    // MobileContent uses overflow-y-auto on #main-content, so scroll events
    // fire on that container, not on window. We listen to both.
    const scrollContainer =
      document.getElementById("main-content") ?? window;
    let lastScrollY = 0;
    const getScrollY = () =>
      scrollContainer instanceof HTMLElement
        ? scrollContainer.scrollTop
        : window.scrollY;
    const handleScroll = () => {
      const currentScrollY = getScrollY();
      setSaveBarVisible(currentScrollY < lastScrollY || currentScrollY < 50);
      lastScrollY = currentScrollY;
    };
    scrollContainer.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    return () =>
      scrollContainer.removeEventListener("scroll", handleScroll);
  }, []);

  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const scrollToSection = (id: string) => {
    setOpenSections((prev) => new Set(prev).add(id));
    // Small delay so the section expands before scrolling
    requestAnimationFrame(() => {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveSection(id);
      }
    });
  };

  const activeCategoryId =
    CATEGORIES.find((cat) =>
      cat.sections.some((s) => s.id === activeSection),
    )?.id ?? CATEGORIES[0].id;

  return (
    <div className="flex flex-col md:flex-row gap-0 md:gap-8 mt-0 md:mt-4 pb-6 md:pb-20">
      {/* Mobile tab bar — sticky horizontal categories */}
      <nav className="md:hidden sticky top-0 z-40 bg-background border-b">
        <h1 className="text-lg font-semibold px-4 pt-3 pb-1">Impostazioni</h1>
        <div className="flex overflow-x-auto gap-1 px-4 pb-2">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => scrollToSection(category.sections[0].id)}
              className={cn(
                "shrink-0 px-3 py-1.5 text-sm font-medium rounded-full transition-all",
                activeCategoryId === category.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground bg-muted/50",
              )}
            >
              {category.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Left navigation - Professional structured menu (desktop) */}
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
      <div className="flex-1 min-w-0 max-w-2xl space-y-3 px-4 md:px-0">
        {/* Business Profile */}
        <CollapsibleSection
          id="profilo-aziendale"
          title="Profilo Aziendale"
          icon={Building2}
          color="text-blue-600"
          isOpen={openSections.has("profilo-aziendale")}
          onToggle={() => toggleSection("profilo-aziendale")}
        >
          <BusinessProfileSettingsSection />
        </CollapsibleSection>

        {/* Branding */}
        <CollapsibleSection
          id="branding"
          title="Marchio"
          icon={Palette}
          color="text-purple-600"
          isOpen={openSections.has("branding")}
          onToggle={() => toggleSection("branding")}
        >
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
        </CollapsibleSection>

        {/* Authentication */}
        <CollapsibleSection
          id="autenticazione"
          title="Autenticazione"
          icon={Shield}
          color="text-green-600"
          isOpen={openSections.has("autenticazione")}
          onToggle={() => toggleSection("autenticazione")}
        >
          <p className="text-sm text-muted-foreground">
            Configurazione SSO con Google Workspace (opzionale).
          </p>
          <TextInput
            source="googleWorkplaceDomain"
            label="Dominio Google Workspace"
            helperText="Es: example.com - lascia vuoto per disabilitare SSO"
          />
        </CollapsibleSection>

        {/* Tags */}
        <CollapsibleSection
          id="tags"
          title="Etichette"
          icon={Tag}
          color="text-orange-600"
          isOpen={openSections.has("tags")}
          onToggle={() => toggleSection("tags")}
        >
          <TagsSettingsSection />
        </CollapsibleSection>

        {/* Quote service types */}
        <CollapsibleSection
          id="quote-types"
          title="Tipi preventivo"
          icon={FileText}
          color="text-amber-600"
          isOpen={openSections.has("quote-types")}
          onToggle={() => toggleSection("quote-types")}
        >
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
        </CollapsibleSection>

        {/* Service type choices */}
        <CollapsibleSection
          id="service-types"
          title="Tipi servizio"
          icon={Briefcase}
          color="text-yellow-600"
          isOpen={openSections.has("service-types")}
          onToggle={() => toggleSection("service-types")}
        >
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
        </CollapsibleSection>

        <CollapsibleSection
          id="operativita"
          title="Operatività"
          icon={Car}
          color="text-cyan-600"
          isOpen={openSections.has("operativita")}
          onToggle={() => toggleSection("operativita")}
        >
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
        </CollapsibleSection>

        {/* Notes */}
        <CollapsibleSection
          id="notes"
          title="Note"
          icon={FileText}
          color="text-teal-600"
          isOpen={openSections.has("notes")}
          onToggle={() => toggleSection("notes")}
        >
          <h3 className="text-lg font-medium text-muted-foreground">Stati</h3>
          <ArrayInput source="noteStatuses" label={false} helperText={false}>
            <SimpleFormIterator inline disableReordering disableClear>
              <TextInput source="label" label={false} className="flex-1" />
              <ColorInput source="color" />
            </SimpleFormIterator>
          </ArrayInput>
        </CollapsibleSection>

        {/* Tasks */}
        <CollapsibleSection
          id="tasks"
          title="Attività"
          icon={Bell}
          color="text-emerald-600"
          isOpen={openSections.has("tasks")}
          onToggle={() => toggleSection("tasks")}
        >
          <h3 className="text-lg font-medium text-muted-foreground">Tipi</h3>
          <ArrayInput source="taskTypes" label={false} helperText={false}>
            <SimpleFormIterator disableReordering disableClear>
              <TextInput source="label" label={false} />
            </SimpleFormIterator>
          </ArrayInput>
        </CollapsibleSection>

        {/* Automazioni */}
        <CollapsibleSection
          id="automazioni"
          title="Automazioni"
          icon={Zap}
          color="text-yellow-500"
          isOpen={openSections.has("automazioni")}
          onToggle={() => toggleSection("automazioni")}
        >
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
        </CollapsibleSection>

        {/* AI */}
        <CollapsibleSection
          id="ai"
          title="AI"
          icon={Bot}
          color="text-violet-600"
          isOpen={openSections.has("ai")}
          onToggle={() => toggleSection("ai")}
        >
          <AISettingsSection />
        </CollapsibleSection>

        {/* Fiscal */}
        <CollapsibleSection
          id="fiscale"
          title="Fiscale"
          icon={Receipt}
          color="text-rose-600"
          isOpen={openSections.has("fiscale")}
          onToggle={() => toggleSection("fiscale")}
        >
          <FiscalSettingsSection />
        </CollapsibleSection>
      </div>

      {/* Save bar — sticky on mobile (auto-hide on scroll), fixed+always visible on desktop */}
      <div className={cn(
        "sticky bottom-0 md:fixed md:bottom-0 md:left-0 md:right-0 z-60 border-t bg-background p-3 md:p-4 transition-all duration-300 md:opacity-100 md:translate-y-0 md:pointer-events-auto",
        saveBarVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none"
      )}>
        <div className="max-w-screen-xl mx-auto flex gap-8 px-0 md:px-4">
          <div className="hidden md:block w-48 shrink-0" />
          <div className="flex-1 min-w-0 max-w-2xl flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
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
                size="sm"
                onClick={() => window.history.back()}
              >
                Annulla
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-1" />
                {isSubmitting ? "..." : "Salva"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/** A collapsible settings section card. */
const CollapsibleSection = ({
  id,
  title,
  icon: Icon,
  color,
  isOpen,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <Card id={id} className="py-0 gap-0">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between px-4 py-3 text-left"
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className={cn("h-5 w-5", color ?? "text-muted-foreground")} />}
        <h2 className="text-base font-semibold text-muted-foreground">{title}</h2>
      </div>
      <ChevronDown
        className={cn(
          "h-4 w-4 text-muted-foreground transition-transform duration-200",
          isOpen && "rotate-180",
        )}
      />
    </button>
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-200",
        isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
    >
      <div className="overflow-hidden">
        <CardContent className="space-y-4 pb-4">{children}</CardContent>
      </div>
    </div>
  </Card>
);

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
