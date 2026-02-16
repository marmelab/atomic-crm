import {
  ArrowDown,
  ArrowUp,
  Check,
  Pencil,
  PlusCircle,
  Save,
  XCircle,
} from "lucide-react";
import { EditBase, Form, useNotify } from "ra-core";
import { useCallback, useMemo, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { IconButtonWithTooltip } from "@/components/admin/icon-button-with-tooltip";
import { TextInput } from "@/components/admin/text-input";

import ImageEditorField from "../misc/ImageEditorField";
import {
  useConfigurationContext,
  useConfigurationUpdater,
  type ConfigurationContextValue,
} from "../root/ConfigurationContext";

const SECTIONS = [
  { id: "branding", label: "Branding" },
  { id: "company-sectors", label: "Company Sectors" },
  { id: "deal-stages", label: "Deal Stages" },
  { id: "deal-categories", label: "Deal Categories" },
  { id: "note-statuses", label: "Note Statuses" },
  { id: "task-types", label: "Task Types" },
];

const transformFormValues = (data: Record<string, any>) => ({
  config: {
    title: data.title,
    lightModeLogo: data.lightModeLogo,
    darkModeLogo: data.darkModeLogo,
    companySectors: data.companySectors,
    dealCategories: data.dealCategories,
    taskTypes: data.taskTypes,
    dealStages: data.dealStages,
    dealPipelineStatuses: data.dealPipelineStatuses,
    noteStatuses: data.noteStatuses,
  } as ConfigurationContextValue,
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
            <div className="flex gap-8">
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">Light Mode Logo</p>
                <ImageEditorField
                  source="lightModeLogo"
                  width={100}
                  height={100}
                  linkPosition="bottom"
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">Dark Mode Logo</p>
                <ImageEditorField
                  source="darkModeLogo"
                  width={100}
                  height={100}
                  linkPosition="bottom"
                  backgroundImageColor="#1a1a2e"
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
            <LabeledValueListInput
              source="companySectors"
              placeholder="New sector"
            />
          </CardContent>
        </Card>

        {/* Deal Stages */}
        <Card id="deal-stages">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Deal Stages
            </h2>
            <LabeledValueListInput
              source="dealStages"
              placeholder="New stage"
              reorderable
            />

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
            <LabeledValueListInput
              source="dealCategories"
              placeholder="New category"
            />
          </CardContent>
        </Card>

        {/* Note Statuses */}
        <Card id="note-statuses">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Note Statuses
            </h2>
            <LabeledValueListInput
              source="noteStatuses"
              placeholder="New status"
            >
              {(item, _index, updateItem) => (
                <input
                  type="color"
                  value={item.color || "#000000"}
                  onChange={(e) => updateItem({ color: e.target.value })}
                  className="w-8 h-8 p-0.5 rounded border cursor-pointer shrink-0"
                />
              )}
            </LabeledValueListInput>
          </CardContent>
        </Card>

        {/* Task Types */}
        <Card id="task-types">
          <CardContent className="space-y-4">
            <h2 className="text-xl font-semibold text-muted-foreground">
              Task Types
            </h2>
            <LabeledValueListInput
              source="taskTypes"
              placeholder="New task type"
            />
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

/**
 * Derive a stable slug value from a display label.
 * e.g. "Communication Services" → "communication-services"
 */
const toSlug = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

type LabeledItem = { value: string; label: string; [key: string]: any };

/**
 * An editable list of { value, label } items, rendered as one row per item.
 * Users only see and edit the label. The value is auto-derived from the label
 * when creating a new item, but remains unchanged when editing an existing one.
 *
 * Extra fields (e.g. color) can be added per row via the children render prop.
 */
const LabeledValueListInput = ({
  source,
  placeholder = "New item",
  reorderable = false,
  children,
}: {
  source: string;
  placeholder?: string;
  reorderable?: boolean;
  children?: (
    item: LabeledItem,
    index: number,
    updateItem: (updates: Record<string, any>) => void,
  ) => React.ReactNode;
}) => {
  const { watch, setValue } = useFormContext();
  const rawItems: (string | LabeledItem)[] = watch(source) ?? [];
  // Normalize plain strings (from old config format) into { value, label }
  const items: LabeledItem[] = rawItems.map((item) =>
    typeof item === "string" ? { value: toSlug(item), label: item } : item,
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const setItems = useCallback(
    (next: LabeledItem[]) => setValue(source, next, { shouldDirty: true }),
    [setValue, source],
  );

  const startEditing = useCallback(
    (index: number) => {
      setEditLabel(items[index].label);
      setEditingIndex(index);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [items],
  );

  const confirmEdit = useCallback(() => {
    if (editingIndex == null) return;
    const trimmed = editLabel.trim();
    if (trimmed) {
      const next = [...items];
      const existing = next[editingIndex];
      // Keep extra fields (e.g. color) and existing value; only derive value for new items
      next[editingIndex] = {
        ...existing,
        value: existing.value || toSlug(trimmed),
        label: trimmed,
      };
      setItems(next);
    }
    setEditingIndex(null);
  }, [editingIndex, editLabel, items, setItems]);

  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
  }, []);

  const removeItem = useCallback(
    (index: number) => {
      setItems(items.filter((_, i) => i !== index));
      if (editingIndex === index) setEditingIndex(null);
    },
    [items, setItems, editingIndex],
  );

  const moveItem = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= items.length) return;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      setItems(next);
      // Keep editing index in sync if the edited item moved
      if (editingIndex === index) setEditingIndex(target);
      else if (editingIndex === target) setEditingIndex(index);
    },
    [items, setItems, editingIndex],
  );

  const addItem = useCallback(() => {
    // Add an empty item — value will be derived on confirm
    setItems([...items, { value: "", label: "" }]);
    setEditLabel("");
    setEditingIndex(items.length);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [items, setItems]);

  return (
    <div className="space-y-1">
      <ul className="space-y-1">
        {items.map((item, index) => {
          const updateItem = (updates: Record<string, any>) => {
            const next = [...items];
            next[index] = { ...next[index], ...updates };
            setItems(next);
          };
          return (
            <li key={index} className="flex items-center gap-1">
              {editingIndex === index ? (
                <>
                  <Input
                    ref={inputRef}
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        confirmEdit();
                      } else if (e.key === "Escape") {
                        cancelEdit();
                      }
                    }}
                    onBlur={confirmEdit}
                    placeholder={placeholder}
                    className="h-8 text-sm"
                  />
                  {children?.(item, index, updateItem)}
                  <IconButtonWithTooltip
                    label="Confirm"
                    onClick={confirmEdit}
                    className="h-8 w-8 shrink-0"
                  >
                    <Check className="h-4 w-4" />
                  </IconButtonWithTooltip>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm px-3 py-1 truncate">
                    {item.label || (
                      <span className="text-muted-foreground italic">
                        (empty)
                      </span>
                    )}
                  </span>
                  {children?.(item, index, updateItem)}
                  <IconButtonWithTooltip
                    label="Edit"
                    onClick={() => startEditing(index)}
                    className="h-8 w-8 shrink-0"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </IconButtonWithTooltip>
                  {reorderable && (
                    <>
                      <IconButtonWithTooltip
                        label="Move up"
                        onClick={() => moveItem(index, -1)}
                        disabled={index === 0}
                        className="h-8 w-8 shrink-0"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </IconButtonWithTooltip>
                      <IconButtonWithTooltip
                        label="Move down"
                        onClick={() => moveItem(index, 1)}
                        disabled={index === items.length - 1}
                        className="h-8 w-8 shrink-0"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </IconButtonWithTooltip>
                    </>
                  )}
                  <IconButtonWithTooltip
                    label="Remove"
                    onClick={() => removeItem(index)}
                    className="h-8 w-8 shrink-0"
                  >
                    <XCircle className="h-4 w-4 text-red-500" />
                  </IconButtonWithTooltip>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={addItem}
        className="mt-1"
      >
        <PlusCircle className="h-4 w-4 mr-1" />
        Add
      </Button>
    </div>
  );
};
