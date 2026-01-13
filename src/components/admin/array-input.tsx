import * as React from "react";
import type { InputProps } from "ra-core";
import {
  FieldTitle,
  isRequired,
  useSourceContext,
  sanitizeInputRestProps,
  ArrayInputBase,
} from "ra-core";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";
import { InputHelperText } from "@/components/admin/input-helper-text";
import { FormError, FormField } from "@/components/admin/form";

/**
 * Creates a list of sub-forms for editing arrays of data embedded inside a record.
 *
 * Use `<ArrayInput>` when you need to edit array fields like order items, tags, or any
 * repeatable embedded data. Requires a form iterator child (typically `<SimpleFormIterator>`)
 * to render and manage individual array items.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/arrayinput/ ArrayInput documentation}
 *
 * @example
 * import {
 *   Edit,
 *   SimpleForm,
 *   TextInput,
 *   NumberInput,
 *   ArrayInput,
 *   SimpleFormIterator,
 * } from '@/components/admin';
 *
 * const OrderEdit = () => (
 *   <Edit>
 *     <SimpleForm>
 *       <TextInput source="customer" />
 *       <TextInput source="date" type="date" />
 *       <ArrayInput source="items">
 *         <SimpleFormIterator inline>
 *           <TextInput source="name" />
 *           <NumberInput source="price" />
 *           <NumberInput source="quantity" />
 *         </SimpleFormIterator>
 *       </ArrayInput>
 *     </SimpleForm>
 *   </Edit>
 * );
 */
export const ArrayInput = (props: ArrayInputProps) => {
  const {
    className,
    defaultValue = [],
    label,
    isPending,
    children,
    helperText,
    resource: resourceFromProps,
    source: arraySource,
    validate,
    ...rest
  } = props;

  const parentSourceContext = useSourceContext();
  const finalSource = parentSourceContext.getSource(arraySource);

  if (isPending) {
    return <Skeleton className="w-full h-9" />;
  }

  return (
    <FormField
      className={cn(
        "ra-input",
        `ra-input-${finalSource}`,
        className,
        "w-full flex flex-col gap-2",
      )}
      name={finalSource}
      {...sanitizeInputRestProps(rest)}
    >
      <Label className="text-sm">
        <FieldTitle
          label={label}
          source={arraySource}
          resource={resourceFromProps}
          isRequired={isRequired(validate)}
        />
      </Label>
      <ArrayInputBase {...props} defaultValue={defaultValue}>
        {children}
      </ArrayInputBase>

      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};

export interface ArrayInputProps
  extends Omit<InputProps, "disabled" | "readOnly"> {
  className?: string;
  children: React.ReactNode;
  isFetching?: boolean;
  isLoading?: boolean;
  isPending?: boolean;
}
