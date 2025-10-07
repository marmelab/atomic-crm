import {
  type InputProps,
  useInput,
  useResourceContext,
  FieldTitle,
} from "ra-core";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { cn } from "@/lib/utils.ts";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InputHelperText } from "@/components/admin/input-helper-text";

export type TextInputProps = InputProps & {
  multiline?: boolean;
  inputClassName?: string;
} & React.ComponentProps<"textarea"> &
  React.ComponentProps<"input">;

export const TextInput = (props: TextInputProps) => {
  const resource = useResourceContext(props);
  const {
    label,
    source,
    multiline,
    className,
    inputClassName,
    validate: _validateProp,
    format: _formatProp,
    ...rest
  } = props;
  const { id, field, isRequired } = useInput(props);

  const value =
    props.type === "datetime-local"
      ? field.value?.slice(0, 16) // Adjust for datetime-local input format
      : props.type === "date"
        ? field.value?.slice(0, 10) // Adjust for date input format
        : field.value;

  return (
    <FormField id={id} className={cn(className, "w-full")} name={field.name}>
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
        {multiline ? (
          <Textarea
            {...rest}
            {...field}
            value={value}
            className={inputClassName}
          />
        ) : (
          <Input
            {...rest}
            {...field}
            value={value}
            className={inputClassName}
          />
        )}
      </FormControl>
      <InputHelperText helperText={props.helperText} />
      <FormError />
    </FormField>
  );
};
