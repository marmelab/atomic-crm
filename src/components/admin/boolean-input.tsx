import React, { useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { FormError, FormField, FormLabel } from "@/components/admin/form";
import { useInput, FieldTitle } from "ra-core";
import { InputHelperText } from "./input-helper-text";

/**
 * Toggle switch for boolean (true/false) values.
 *
 * Use `<BooleanInput>` for binary settings like "is published", "is active", or feature flags.
 * Leverages shadcn's Switch component for a native-looking toggle. Note: this input doesn't
 * support `null` values—use `<SelectInput>` for nullable booleans.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/booleaninput/ BooleanInput documentation}
 * @see {@link https://ui.shadcn.com/docs/components/switch Switch documentation}
 *
 * @example
 * import {
 *   Edit,
 *   SimpleForm,
 *   BooleanInput,
 *   TextInput,
 * } from '@/components/admin';
 *
 * const PostEdit = () => (
 *   <Edit>
 *     <SimpleForm>
 *       <TextInput source="title" />
 *       <BooleanInput source="is_published" />
 *       <BooleanInput source="allow_comments" />
 *     </SimpleForm>
 *   </Edit>
 * );
 */
export const BooleanInput = (props: BooleanInputProps) => {
  const {
    className,
    defaultValue = false,
    format,
    label,
    helperText,
    onBlur,
    onChange,
    onFocus,
    readOnly,
    disabled,
    parse,
    resource,
    source,
    validate,
    ...rest
  } = props;
  const { id, field, isRequired } = useInput({
    defaultValue,
    format,
    parse,
    resource,
    source,
    onBlur,
    onChange,
    type: "checkbox",
    validate,
    disabled,
    readOnly,
    ...rest,
  });

  const handleChange = useCallback(
    (checked: boolean) => {
      field.onChange(checked);
      // Ensure field is considered as touched
      field.onBlur();
    },
    [field],
  );

  return (
    <FormField className={className} id={id} name={field.name}>
      <div className="flex items-center space-x-2">
        <Switch
          id={id}
          checked={Boolean(field.value)}
          onFocus={onFocus}
          onCheckedChange={handleChange}
        />
        <FormLabel htmlFor={id}>
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            isRequired={isRequired}
          />
        </FormLabel>
      </div>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};

export interface BooleanInputProps {
  className?: string;
  defaultValue?: boolean;
  format?: (value: any) => any;
  helperText?: React.ReactNode;
  label?: React.ReactNode;
  onBlur?: (event: React.FocusEvent<HTMLButtonElement>) => void;
  onChange?: (value: any) => void;
  onFocus?: (event: React.FocusEvent<HTMLButtonElement>) => void;
  readOnly?: boolean;
  disabled?: boolean;
  parse?: (value: any) => any;
  resource?: string;
  source: string;
  validate?: any;
}
