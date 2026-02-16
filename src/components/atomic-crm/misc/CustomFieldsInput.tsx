import { useGetList } from "ra-core";
import { TextInput } from "@/components/admin/text-input";
import { BooleanInput } from "@/components/admin/boolean-input";
import { SelectInput } from "@/components/admin/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import type { CustomFieldDefinition, CustomFieldEntityType } from "../types";

export const CustomFieldsInput = ({
  entityType,
}: {
  entityType: CustomFieldEntityType;
}) => {
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
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!fields?.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-base font-semibold">Custom Fields</h3>
      <p className="text-sm text-muted-foreground -mt-2">
        Fields defined by your administrator
      </p>
      {fields.map((field) => {
        const source = `custom_fields.${field.key}`;
        const label = field.label + (field.is_required ? " *" : "");
        const commonProps = {
          key: field.id,
          source,
          label,
          helperText: field.help_text || false,
        };

        switch (field.data_type) {
          case "boolean":
            return <BooleanInput {...commonProps} />;

          case "enum":
            return (
              <SelectInput
                {...commonProps}
                choices={
                  Array.isArray(field.options)
                    ? field.options.map((opt) =>
                        typeof opt === "string"
                          ? { id: opt, name: opt }
                          : { id: opt.value, name: opt.label }
                      )
                    : []
                }
              />
            );

          case "number":
            return <TextInput {...commonProps} type="number" />;

          case "date":
            return <TextInput {...commonProps} type="date" />;

          case "url":
            return <TextInput {...commonProps} type="url" placeholder="https://" />;

          case "email":
            return <TextInput {...commonProps} type="email" placeholder="email@example.com" />;

          case "phone":
            return <TextInput {...commonProps} type="tel" placeholder="+1 (555) 000-0000" />;

          case "string":
          default:
            return <TextInput {...commonProps} multiline={field.input_type === "textarea"} />;
        }
      })}
    </div>
  );
};
