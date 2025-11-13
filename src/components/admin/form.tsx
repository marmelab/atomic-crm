import * as React from "react";
import type { MouseEventHandler } from "react";
import { createContext, useCallback, useContext, useMemo } from "react";
import type {
  CreateParams,
  RaRecord,
  TransformData,
  UpdateParams,
} from "ra-core";
import {
  setSubmissionErrors,
  useRecordFromLocation,
  useSaveContext,
  useTranslate,
  ValidationError,
  warning,
} from "ra-core";
import { Loader2, Save } from "lucide-react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import { FormProvider, useFormContext, useFormState } from "react-hook-form";
import type { UseMutationOptions } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const Form = FormProvider;

type FormItemContextValue = {
  id: string;
  name: string;
};

const FormItemContext = createContext<FormItemContextValue>(
  {} as FormItemContextValue,
);

const useFormField = () => {
  const { getFieldState, formState } = useFormContext();
  const { id, name } = useContext(FormItemContext);

  const fieldState = getFieldState(name, formState);

  return useMemo(
    () => ({
      formItemId: id,
      formDescriptionId: `${id}-description`,
      formMessageId: `${id}-message`,
      ...fieldState,
    }),
    [id, fieldState],
  );
};

function FormField({ className, id, name, ...props }: FormItemProps) {
  const contextValue: FormItemContextValue = useMemo(
    () => ({
      id,
      name,
    }),
    [id, name],
  );

  return (
    <FormItemContext.Provider value={contextValue}>
      <div
        data-slot="form-item"
        className={cn("grid gap-2", className)}
        role="group"
        {...props}
      />
    </FormItemContext.Provider>
  );
}

type FormItemProps = Omit<React.ComponentProps<"div">, "id"> & {
  id: string;
  name: string;
};

function FormLabel({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  const { error, formItemId } = useFormField();

  return (
    <Label
      data-slot="form-label"
      data-error={!!error}
      className={cn("data-[error=true]:text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  );
}

function FormControl({ ...props }: React.ComponentProps<typeof Slot>) {
  const { error, formItemId, formDescriptionId, formMessageId } =
    useFormField();

  return (
    <Slot
      data-slot="form-control"
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  );
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { formDescriptionId } = useFormField();

  return (
    <div
      data-slot="form-description"
      id={formDescriptionId}
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

const FormError = ({ className, ...props }: React.ComponentProps<"p">) => {
  const { invalid, error, formMessageId } = useFormField();

  const err = error?.root?.message ?? error?.message;
  if (!invalid || !err) {
    return null;
  }

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn("text-destructive text-sm", className)}
      {...props}
    >
      <ValidationError error={err} />
    </p>
  );
};

const SaveButton = <RecordType extends RaRecord = RaRecord>(
  props: SaveButtonProps<RecordType>,
) => {
  const {
    className,
    icon = defaultIcon,
    label = "ra.action.save",
    onClick,
    mutationOptions,
    disabled: disabledProp,
    type = "submit",
    transform,
    variant = "default",
    alwaysEnable = false,
    ...rest
  } = props;
  const translate = useTranslate();
  const form = useFormContext();
  const saveContext = useSaveContext();
  const { dirtyFields, isValidating, isSubmitting } = useFormState();
  // useFormState().isDirty might differ from useFormState().dirtyFields (https://github.com/react-hook-form/react-hook-form/issues/4740)
  const isDirty = Object.keys(dirtyFields).length > 0;
  // Use form isDirty, isValidating and form context saving to enable or disable the save button
  // if alwaysEnable is undefined and the form wasn't prefilled
  const recordFromLocation = useRecordFromLocation();
  const disabled = valueOrDefault(
    alwaysEnable === false || alwaysEnable === undefined
      ? undefined
      : !alwaysEnable,
    disabledProp ||
      (!isDirty && recordFromLocation == null) ||
      isValidating ||
      isSubmitting,
  );

  warning(
    type === "submit" &&
      ((mutationOptions &&
        (mutationOptions.onSuccess || mutationOptions.onError)) ||
        transform),
    'Cannot use <SaveButton mutationOptions> props on a button of type "submit". To override the default mutation options on a particular save button, set the <SaveButton type="button"> prop, or set mutationOptions in the main view component (<Create> or <Edit>).',
  );

  const handleSubmit = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (values: any) => {
      let errors;
      if (saveContext?.save) {
        errors = await saveContext.save(values, {
          ...mutationOptions,
          transform,
        });
      }
      if (errors != null) {
        setSubmissionErrors(errors, form.setError);
      }
    },
    [form.setError, saveContext, mutationOptions, transform],
  );

  const handleClick: MouseEventHandler<HTMLButtonElement> = useCallback(
    async (event) => {
      if (onClick) {
        onClick(event);
      }
      if (event.defaultPrevented) {
        return;
      }
      if (type === "button") {
        // this button doesn't submit the form, so it doesn't trigger useIsFormInvalid in <FormContent>
        // therefore we need to check for errors manually
        event.stopPropagation();
        await form.handleSubmit(handleSubmit)(event);
      }
    },
    [onClick, type, form, handleSubmit],
  );

  const displayedLabel = label && translate(label, { _: label });

  return (
    <Button
      variant={variant}
      type={type}
      disabled={disabled}
      onClick={handleClick}
      className={cn(
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        className,
      )}
      {...rest}
    >
      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : icon}
      {displayedLabel}
    </Button>
  );
};

const defaultIcon = <Save className="h-4 w-4" />;

interface Props<
  RecordType extends RaRecord = RaRecord,
  MutationOptionsError = unknown,
> {
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  label?: string;
  mutationOptions?: UseMutationOptions<
    RecordType,
    MutationOptionsError,
    CreateParams<RecordType> | UpdateParams<RecordType>
  >;
  transform?: TransformData;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
}

export type SaveButtonProps<RecordType extends RaRecord = RaRecord> =
  Props<RecordType> &
    React.ComponentProps<"button"> & {
      alwaysEnable?: boolean;
    };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const valueOrDefault = (value: any, defaultValue: any) =>
  typeof value === "undefined" ? defaultValue : value;

export {
  // eslint-disable-next-line react-refresh/only-export-components
  useFormField,
  Form,
  FormField,
  FormLabel,
  FormControl,
  FormDescription,
  FormError,
  SaveButton,
};
