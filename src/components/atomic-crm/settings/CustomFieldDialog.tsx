import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useCreate, useUpdate, useGetIdentity } from "ra-core";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { CustomFieldDefinition, CustomFieldEntityType, CustomFieldDataType, CustomFieldInputType } from "../types";

type FormData = {
  key: string;
  label: string;
  data_type: CustomFieldDataType;
  input_type: CustomFieldInputType;
  is_required: boolean;
  is_filterable: boolean;
  help_text: string;
  options: string;
};

const DATA_TYPES: Array<{ value: CustomFieldDataType; label: string }> = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes/No" },
  { value: "enum", label: "Dropdown (Single)" },
  { value: "multi_enum", label: "Dropdown (Multiple)" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
];

const INPUT_TYPE_MAP: Record<CustomFieldDataType, CustomFieldInputType> = {
  string: "text",
  number: "number",
  date: "date",
  boolean: "checkbox",
  enum: "select",
  multi_enum: "multiselect",
  url: "url",
  email: "email",
  phone: "phone",
};

export const CustomFieldDialog = ({
  open,
  onClose,
  entityType,
  editingField,
}: {
  open: boolean;
  onClose: () => void;
  entityType: CustomFieldEntityType;
  editingField: CustomFieldDefinition | null;
}) => {
  const { identity } = useGetIdentity();
  const [create, { isPending: isCreating }] = useCreate();
  const [update, { isPending: isUpdating }] = useUpdate();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      key: "",
      label: "",
      data_type: "string",
      input_type: "text",
      is_required: false,
      is_filterable: true,
      help_text: "",
      options: "",
    },
  });

  const dataType = watch("data_type");
  const showOptions = dataType === "enum" || dataType === "multi_enum";

  useEffect(() => {
    if (editingField) {
      reset({
        key: editingField.key,
        label: editingField.label,
        data_type: editingField.data_type,
        input_type: editingField.input_type,
        is_required: editingField.is_required,
        is_filterable: editingField.is_filterable,
        help_text: editingField.help_text || "",
        options: Array.isArray(editingField.options)
          ? editingField.options.join("\n")
          : "",
      });
    } else {
      reset({
        key: "",
        label: "",
        data_type: "string",
        input_type: "text",
        is_required: false,
        is_filterable: true,
        help_text: "",
        options: "",
      });
    }
  }, [editingField, reset]);

  useEffect(() => {
    setValue("input_type", INPUT_TYPE_MAP[dataType]);
  }, [dataType, setValue]);

  const onSubmit = async (data: FormData) => {
    const options = showOptions
      ? data.options
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : [];

    const payload = {
      entity_type: entityType,
      key: data.key.toLowerCase().replace(/\s+/g, "_"),
      label: data.label,
      data_type: data.data_type,
      input_type: data.input_type,
      is_required: data.is_required,
      is_filterable: data.is_filterable,
      is_active: true,
      help_text: data.help_text || null,
      options: options.length > 0 ? options : [],
      sort_order: 999,
    };

    try {
      if (editingField) {
        await update("custom_field_definitions", {
          id: editingField.id,
          data: payload,
        });
      } else {
        await create("custom_field_definitions", {
          data: {
            ...payload,
            workspace_id: identity?.workspace_id || 1, // TODO: Get from context
          },
        });
      }
      onClose();
    } catch (error) {
      console.error("Error saving custom field:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>
              {editingField ? "Edit Custom Field" : "Create Custom Field"}
            </DialogTitle>
            <DialogDescription>
              Define a new field to capture additional data for {entityType}s.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-6">
            <div className="grid gap-2">
              <Label htmlFor="label">Field Label *</Label>
              <Input
                id="label"
                placeholder="e.g., Industry Type"
                {...register("label", { required: "Label is required" })}
              />
              {errors.label && (
                <p className="text-sm text-destructive">{errors.label.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="key">Field Key *</Label>
              <Input
                id="key"
                placeholder="e.g., industry_type"
                {...register("key", {
                  required: "Key is required",
                  pattern: {
                    value: /^[a-z0-9_]+$/,
                    message: "Only lowercase letters, numbers, and underscores",
                  },
                })}
                disabled={!!editingField}
              />
              <p className="text-xs text-muted-foreground">
                Used in code and exports. Cannot be changed after creation.
              </p>
              {errors.key && (
                <p className="text-sm text-destructive">{errors.key.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="data_type">Field Type *</Label>
              <Select
                value={dataType}
                onValueChange={(value) => setValue("data_type", value as CustomFieldDataType)}
              >
                <SelectTrigger id="data_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showOptions && (
              <div className="grid gap-2">
                <Label htmlFor="options">Options (one per line) *</Label>
                <Textarea
                  id="options"
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                  rows={5}
                  {...register("options", {
                    required: showOptions ? "Options are required for dropdown fields" : false,
                  })}
                />
                {errors.options && (
                  <p className="text-sm text-destructive">{errors.options.message}</p>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="help_text">Help Text</Label>
              <Input
                id="help_text"
                placeholder="Optional description or instructions"
                {...register("help_text")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_required">Required Field</Label>
                <p className="text-xs text-muted-foreground">
                  Users must fill this field
                </p>
              </div>
              <Switch
                id="is_required"
                checked={watch("is_required")}
                onCheckedChange={(checked) => setValue("is_required", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_filterable">Filterable</Label>
                <p className="text-xs text-muted-foreground">
                  Allow filtering by this field
                </p>
              </div>
              <Switch
                id="is_filterable"
                checked={watch("is_filterable")}
                onCheckedChange={(checked) => setValue("is_filterable", checked)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || isUpdating}>
              {editingField ? "Update" : "Create"} Field
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
