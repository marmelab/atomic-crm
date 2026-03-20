import { RotateCcw, Save, Trash2, Users, Globe } from "lucide-react";
import type { RaRecord } from "ra-core";
import { EditBase, Form, useGetList, useInput, useNotify } from "ra-core";
import { useCallback, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toSlug } from "@/lib/toSlug";
import { ArrayInput } from "@/components/admin/array-input";
import { SimpleFormIterator } from "@/components/admin/simple-form-iterator";
import { TextInput } from "@/components/admin/text-input";

import ImageEditorField from "../misc/ImageEditorField";
import {
  useConfigurationContext,
  useConfigurationUpdater,
  type ConfigurationContextValue,
  type CustomView,
} from "../root/ConfigurationContext";
import { defaultConfiguration } from "../root/defaultConfiguration";

const SECTIONS = [
  { id: "branding", label: "Personnalisation" },
  { id: "companies", label: "Sociétés" },
  { id: "deals", label: "Opportunités" },
  { id: "views", label: "Vues" },
  { id: "notes", label: "Notes" },
  { id: "tasks", label: "Tâches" },
];

/** Ensure every item in a { value, label } array has a value (slug from label). */
const ensureValues = (items: { value?: string; label: string }[] | undefined) =>
  items?.map((item) => ({ ...item, value: item.value || toSlug(item.label) }));

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
    return `Duplicate ${displayName}: ${[...duplicates].join(", ")}`;
  }
  // Check that no in-use value was removed (skip if deals haven't loaded)
  if (!deals) return "Validation…";
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
    return `Cannot remove ${displayName} that are still used by deals: ${inUse.join(", ")}`;
  }
  return undefined;
};

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
          notify("Configuration enregistrée");
        },
        onError: () => {
          notify("Erreur lors de l'enregistrement", { type: "error" });
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
    (stages: { value: string; label: string }[] | undefined) =>
      validateItemsInUse(stages, deals, "stage", "stages"),
    [deals],
  );

  const validateDealCategories = useCallback(
    (categories: { value: string; label: string }[] | undefined) =>
      validateItemsInUse(categories, deals, "category", "categories"),
    [deals],
  );

  return (
    <div className="flex gap-8 mt-4 pb-20">
      {/* Left navigation */}
      <nav className="hidden md:block w-48 shrink-0">
        <div className="sticky top-4 space-y-1">
          <h1 className="text-2xl font-semibold px-3 mb-2">Paramètres</h1>
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
              Personnalisation
            </h2>
            <TextInput source="title" label="Titre de l'application" />
            <div className="flex gap-8">
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">Logo (mode clair)</p>
                <ImageEditorField
                  source="lightModeLogo"
                  width={100}
                  height={100}
                  linkPosition="bottom"
                  backgroundImageColor="#f5f5f5"
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">Logo (mode sombre)</p>
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

        {/* Companies */}
        <Card id="companies">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Sociétés
            </h2>
            <h3 className="text-lg font-medium text-muted-foreground">
              Secteurs
            </h3>
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

        {/* Deals */}
        <Card id="deals">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Opportunités
            </h2>
            <h3 className="text-lg font-medium text-muted-foreground">
              Étapes
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
              Statuts pipeline
            </h3>
            <p className="text-sm text-muted-foreground">
              Sélectionnez les étapes considérées comme &quot;gagnées&quot; dans
              le pipeline.
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

            <Separator />

            <h3 className="text-lg font-medium text-muted-foreground">
              Catégories
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
          </CardContent>
        </Card>

        {/* Notes */}
        <Card id="notes">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Notes
            </h2>
            <h3 className="text-lg font-medium text-muted-foreground">
              Statuts
            </h3>
            <ArrayInput source="noteStatuses" label={false} helperText={false}>
              <SimpleFormIterator inline disableReordering disableClear>
                <TextInput source="label" label={false} className="flex-1" />
                <ColorInput source="color" />
              </SimpleFormIterator>
            </ArrayInput>
          </CardContent>
        </Card>

        {/* Custom Views */}
        <CustomViewsSection />

        {/* Tasks */}
        <Card id="tasks">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Tâches
            </h2>
            <h3 className="text-lg font-medium text-muted-foreground">Types</h3>
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
              Réinitialiser
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.history.back()}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-1" />
                {isSubmitting ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CustomViewsSection = () => {
  const config = useConfigurationContext();
  const { customViews, dealStages, companyTypes } = config;
  const updateConfiguration = useConfigurationUpdater();

  const { data: allSales } = useGetList("sales", {
    pagination: { page: 1, perPage: 100 },
    sort: { field: "first_name", order: "ASC" },
    filter: { "disabled@neq": true },
  });

  const handleDeleteView = (viewId: string) => {
    updateConfiguration({
      ...config,
      customViews: customViews.filter((v) => v.id !== viewId),
    });
  };

  const handleToggleStage = (view: CustomView, stageValue: string) => {
    const currentVisible = view.visibleStages ?? dealStages.map((s) => s.value);
    const isVisible = currentVisible.includes(stageValue);
    let newVisible: string[];
    if (isVisible) {
      if (currentVisible.length === 1) return;
      newVisible = currentVisible.filter((s) => s !== stageValue);
    } else {
      newVisible = [...currentVisible, stageValue];
    }
    updateConfiguration({
      ...config,
      customViews: customViews.map((v) =>
        v.id === view.id ? { ...v, visibleStages: newVisible } : v,
      ),
    });
  };

  const handleResetStages = (viewId: string) => {
    updateConfiguration({
      ...config,
      customViews: customViews.map((v) =>
        v.id === viewId ? { ...v, visibleStages: undefined } : v,
      ),
    });
  };

  const handleToggleUser = (view: CustomView, userId: number) => {
    const current = view.allowedUserIds ?? [];
    const isAllowed = current.includes(userId);
    const newAllowed = isAllowed
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    updateConfiguration({
      ...config,
      customViews: customViews.map((v) =>
        v.id === view.id ? { ...v, allowedUserIds: newAllowed } : v,
      ),
    });
  };

  const handleSetAllUsers = (viewId: string) => {
    updateConfiguration({
      ...config,
      customViews: customViews.map((v) =>
        v.id === viewId ? { ...v, allowedUserIds: undefined } : v,
      ),
    });
  };

  return (
    <Card id="views">
      <CardContent className="space-y-4">
        <h2 className="text-xl font-semibold text-muted-foreground">Vues</h2>
        {customViews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune vue personnalisée. Cliquez sur &quot;+&quot; dans la barre de
            navigation pour en créer une.
          </p>
        ) : (
          <div className="space-y-6">
            {customViews.map((view) => {
              const companyTypeLabel =
                companyTypes.find((t) => t.value === view.companyType)?.label ??
                view.companyType;
              const visibleSet = new Set(
                view.visibleStages ?? dealStages.map((s) => s.value),
              );
              const hasCustomStages = view.visibleStages !== undefined;
              const isOpenToAll = !view.allowedUserIds?.length;

              return (
                <div key={view.id} className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-medium">{view.label}</h3>
                      <p className="text-xs text-muted-foreground">
                        Type : {companyTypeLabel}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteView(view.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Access control */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      Accès
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {/* "Tous" button */}
                      <button
                        type="button"
                        onClick={() => handleSetAllUsers(view.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          isOpenToAll
                            ? "bg-[var(--nosho-green)]/10 border-[var(--nosho-green)]/40 text-[var(--nosho-green-dark)]"
                            : "bg-muted/50 border-border text-muted-foreground hover:border-muted-foreground/40"
                        }`}
                      >
                        <Globe className="h-3 w-3" />
                        Tous
                      </button>
                      {/* Per-user toggles */}
                      {allSales?.map((sale) => {
                        const isAllowed =
                          isOpenToAll ||
                          view.allowedUserIds?.includes(sale.id as number);
                        const initials = `${sale.first_name?.[0] ?? ""}${sale.last_name?.[0] ?? ""}`.toUpperCase();
                        return (
                          <button
                            key={sale.id}
                            type="button"
                            onClick={() =>
                              handleToggleUser(view, sale.id as number)
                            }
                            title={`${sale.first_name} ${sale.last_name}`}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                              isAllowed && !isOpenToAll
                                ? "bg-[var(--nosho-green)]/10 border-[var(--nosho-green)]/40 text-[var(--nosho-green-dark)]"
                                : isOpenToAll
                                  ? "bg-muted/30 border-border/50 text-muted-foreground/50"
                                  : "bg-muted/50 border-border text-muted-foreground hover:border-muted-foreground/40"
                            }`}
                          >
                            <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[9px] font-bold shrink-0">
                              {initials}
                            </span>
                            {sale.first_name} {sale.last_name}
                          </button>
                        );
                      })}
                    </div>
                    {!isOpenToAll && (
                      <p className="text-xs text-muted-foreground">
                        Les admins ont toujours accès à toutes les vues.
                      </p>
                    )}
                  </div>

                  {/* Stage visibility */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Étapes visibles
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {dealStages.map((stage) => {
                        const isVisible = visibleSet.has(stage.value);
                        return (
                          <Button
                            key={stage.value}
                            type="button"
                            variant={isVisible ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleToggleStage(view, stage.value)}
                          >
                            {stage.label || stage.value}
                          </Button>
                        );
                      })}
                    </div>
                    {hasCustomStages && (
                      <button
                        type="button"
                        onClick={() => handleResetStages(view.id)}
                        className="text-xs text-muted-foreground underline hover:text-foreground"
                      >
                        Réinitialiser (tout afficher)
                      </button>
                    )}
                  </div>

                  <Separator />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
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
