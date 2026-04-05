import * as React from "react";
import { useEffect, useState } from "react";
import type { InputProps } from "ra-core";
import { FieldTitle, useInput, useResourceContext } from "ra-core";
import { FormControl, FormField, FormLabel } from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import { FormError } from "@/components/admin/form";
import { InputHelperText } from "@/components/admin/input-helper-text";

/**
 * Input component for numeric values (integers and floats) with parsing and formatting support.
 *
 * Use `<NumberInput>` for prices, quantities, counts, or any numeric field. Manages a local string
 * state internally so users can type incomplete numbers (e.g. '-' or '0.') before the value is parsed.
 * Supports min/max constraints and step increments.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/numberinput/ NumberInput documentation}
 *
 * @example
 * import { Edit, SimpleForm, NumberInput, TextInput } from '@/components/admin';
 *
 * const ProductEdit = () => (
 *   <Edit>
 *     <SimpleForm>
 *       <TextInput source="name" />
 *       <NumberInput source="price" step={0.01} min={0} />
 *       <NumberInput source="quantity" min={0} />
 *     </SimpleForm>
 *   </Edit>
 * );
 */
export const NumberInput = (props: NumberInputProps) => {
  const {
    label,
    source,
    className,
    resource: resourceProp,
    validate: _validateProp,
    format: _formatProp,
    parse = convertStringToNumber,
    onFocus,
    helperText,
    ...rest
  } = props;
  const resource = useResourceContext({ resource: resourceProp });

  const { id, field, isRequired } = useInput(props);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const numberValue = parse(value);

    setValue(value);
    field.onChange(numberValue ?? 0);
  };

  const [value, setValue] = useState<string | undefined>(
    field.value?.toString() ?? "",
  );

  const hasFocus = React.useRef(false);

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    onFocus?.(event);
    hasFocus.current = true;
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    field.onBlur?.(event);
    hasFocus.current = false;
    setValue(field.value?.toString() ?? "");
  };

  useEffect(() => {
    if (!hasFocus.current) {
      setValue(field.value?.toString() ?? "");
    }
  }, [field.value]);

  return (
    <FormField id={id} className={className} name={field.name}>
      {label !== false && (
        <FormLabel>
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            isRequired={isRequired}
          />
        </FormLabel>
      )}
      <FormControl>
        <Input
          {...rest}
          {...field}
          type="number"
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};

export interface NumberInputProps
  extends
    InputProps,
    Omit<
      React.ComponentProps<"input">,
      "defaultValue" | "onBlur" | "onChange" | "type"
    > {
  parse?: (value: string) => number;
}

const convertStringToNumber = (value?: string | null) => {
  if (value == null || value === "") {
    return null;
  }
  const float = parseFloat(value);

  return isNaN(float) ? 0 : float;
};
