import { useGetList } from "ra-core";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { CustomFieldDefinition, CustomFieldEntityType } from "../types";

export const DynamicFieldRenderer = ({ entityType }: { entityType: CustomFieldEntityType }) => {
  const { data: fields, isPending } = useGetList<CustomFieldDefinition>(
    "custom_field_definitions",
    {
      filter: { entity_type: entityType, is_active: true },
      sort: { field: "sort_order", order: "ASC" },
      pagination: { page: 1, perPage: 100 },
    }
  );

  if (isPending) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!fields?.length) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="border-t pt-4">
        <h3 className="text-sm font-semibold mb-4">Custom Fields</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((field) => (
            <DynamicField key={field.id} field={field} />
          ))}
        </div>
      </div>
    </div>
  );
};

const DynamicField = ({ field }: { field: CustomFieldDefinition }) => {
  const { register, watch, setValue } = useFormContext();
  const fieldPath = `custom_fields.${field.key}`;
  const value = watch(fieldPath);

  const renderInput = () => {
    switch (field.input_type) {
      case "textarea":
        return (
          <Textarea
            id={fieldPath}
            placeholder={field.help_text || ""}
            {...register(fieldPath, { required: field.is_required })}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            id={fieldPath}
            placeholder={field.help_text || ""}
            {...register(fieldPath, { required: field.is_required, valueAsNumber: true })}
          />
        );

      case "date":
        return (
          <Input
            type="date"
            id={fieldPath}
            {...register(fieldPath, { required: field.is_required })}
          />
        );

      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={fieldPath}
              checked={value || false}
              onCheckedChange={(checked) => setValue(fieldPath, checked)}
            />
            <Label htmlFor={fieldPath} className="text-sm font-normal cursor-pointer">
              {field.help_text || field.label}
            </Label>
          </div>
        );

      case "select":
        return (
          <Select
            value={value || ""}
            onValueChange={(val) => setValue(fieldPath, val)}
          >
            <SelectTrigger id={fieldPath}>
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {Array.isArray(field.options) &&
                field.options.map((option) => (
                  <SelectItem
                    key={typeof option === "string" ? option : option.value}
                    value={typeof option === "string" ? option : option.value}
                  >
                    {typeof option === "string" ? option : option.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        );

      case "multiselect":
        // For multi-select, we'll use a simplified approach with checkboxes
        return (
          <div className="space-y-2 border rounded-md p-3">
            {Array.isArray(field.options) &&
              field.options.map((option) => {
                const optionValue = typeof option === "string" ? option : option.value;
                const optionLabel = typeof option === "string" ? option : option.label;
                const selected = Array.isArray(value) && value.includes(optionValue);

                return (
                  <div key={optionValue} className="flex items-center space-x-2">
                    <Checkbox
                      id={`${fieldPath}-${optionValue}`}
                      checked={selected}
                      onCheckedChange={(checked) => {
                        const currentValue = Array.isArray(value) ? value : [];
                        if (checked) {
                          setValue(fieldPath, [...currentValue, optionValue]);
                        } else {
                          setValue(
                            fieldPath,
                            currentValue.filter((v) => v !== optionValue)
                          );
                        }
                      }}
                    />
                    <Label
                      htmlFor={`${fieldPath}-${optionValue}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {optionLabel}
                    </Label>
                  </div>
                );
              })}
          </div>
        );

      case "url":
        return (
          <Input
            type="url"
            id={fieldPath}
            placeholder={field.help_text || "https://"}
            {...register(fieldPath, {
              required: field.is_required,
              pattern: {
                value: /^https?:\/\/.+/,
                message: "Must be a valid URL",
              },
            })}
          />
        );

      case "email":
        return (
          <Input
            type="email"
            id={fieldPath}
            placeholder={field.help_text || "email@example.com"}
            {...register(fieldPath, {
              required: field.is_required,
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: "Must be a valid email",
              },
            })}
          />
        );

      case "phone":
        return (
          <Input
            type="tel"
            id={fieldPath}
            placeholder={field.help_text || "+1 (555) 000-0000"}
            {...register(fieldPath, { required: field.is_required })}
          />
        );

      case "text":
      default:
        return (
          <Input
            type="text"
            id={fieldPath}
            placeholder={field.help_text || ""}
            {...register(fieldPath, { required: field.is_required })}
          />
        );
    }
  };

  // For checkbox type, we don't show a separate label
  if (field.input_type === "checkbox") {
    return <div className="md:col-span-2">{renderInput()}</div>;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldPath}>
        {field.label}
        {field.is_required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {renderInput()}
      {field.help_text && field.input_type !== "checkbox" && (
        <p className="text-xs text-muted-foreground">{field.help_text}</p>
      )}
    </div>
  );
};
