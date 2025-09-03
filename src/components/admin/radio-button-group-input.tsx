import * as React from "react";
import {
  type ChoicesProps,
  type InputProps,
  FieldTitle,
  useChoices,
  useChoicesContext,
  useInput,
} from "ra-core";
import { cn } from "@/lib/utils";
import {
  FormField,
  FormControl,
  FormLabel,
  FormError,
} from "@/components/admin/form";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { InputHelperText } from "@/components/admin/input-helper-text";

export const RadioButtonGroupInput = (inProps: RadioButtonGroupInputProps) => {
  const {
    choices: choicesProp,
    isFetching: isFetchingProp,
    isLoading: isLoadingProp,
    isPending: isPendingProp,
    resource: resourceProp,
    source: sourceProp,

    format,
    onBlur,
    onChange,
    parse,
    validate,
    disabled,
    readOnly,

    optionText,
    optionValue = "id",
    translateChoice,
    disableValue = "disabled",

    className,
    helperText,
    label,
    row,
    ...rest
  } = inProps;

  const {
    allChoices,
    isPending,
    error: fetchError,
    resource,
    source,
  } = useChoicesContext({
    choices: choicesProp,
    isFetching: isFetchingProp,
    isLoading: isLoadingProp,
    isPending: isPendingProp,
    resource: resourceProp,
    source: sourceProp,
  });

  if (source === undefined) {
    throw new Error(
      `If you're not wrapping the RadioButtonGroupInput inside a ReferenceArrayInput, you must provide the source prop`,
    );
  }

  if (!isPending && !fetchError && allChoices === undefined) {
    throw new Error(
      `If you're not wrapping the RadioButtonGroupInput inside a ReferenceArrayInput, you must provide the choices prop`,
    );
  }

  const { id, field, isRequired } = useInput({
    format,
    onBlur,
    onChange,
    parse,
    resource,
    source,
    validate,
    disabled,
    readOnly,
    ...rest,
  });

  const { getChoiceText, getChoiceValue, getDisableValue } = useChoices({
    optionText,
    optionValue,
    translateChoice,
    disableValue,
  });

  if (isPending) {
    return <Skeleton className="w-full h-9" />;
  }

  return (
    <FormField id={id} className={className} name={field.name}>
      {label && (
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
        <RadioGroup
          {...rest}
          value={field.value || ""}
          onValueChange={field.onChange}
          className={cn("flex", row ? "flex-row gap-4" : "flex-col gap-2")}
          disabled={disabled || readOnly}
        >
          {allChoices?.map((choice) => {
            const value = getChoiceValue(choice);
            const isDisabled = disabled || readOnly || getDisableValue(choice);

            return (
              <div key={value} className="flex items-center space-x-2">
                <RadioGroupItem
                  value={value}
                  id={`${id}-${value}`}
                  disabled={isDisabled}
                />
                <Label
                  htmlFor={`${id}-${value}`}
                  className={cn(
                    "text-sm font-normal cursor-pointer",
                    isDisabled && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {getChoiceText(choice)}
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};

export interface RadioButtonGroupInputProps
  extends Partial<InputProps>,
    ChoicesProps,
    Omit<
      React.ComponentProps<typeof RadioGroup>,
      "defaultValue" | "onBlur" | "onChange" | "type"
    > {
  row?: boolean;
}
