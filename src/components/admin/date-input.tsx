import * as React from "react";
import type { InputProps } from "ra-core";
import { useInput, FieldTitle, useEvent, useResourceContext } from "ra-core";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { Input } from "@/components/ui/input";
import { InputHelperText } from "@/components/admin/input-helper-text";
import { cn } from "@/lib/utils";

/**
 * Date picker input for editing date values in "YYYY-MM-DD" format.
 *
 * Use `<DateInput>` for publication dates, deadlines, birthdays, or any date field. Renders
 * a native browser date picker (appearance varies by browser). Automatically handles date parsing
 * from ISO strings, Date objects, or timestamps.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/dateinput/ DateInput documentation}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/date MDN documentation for input type="date"}
 *
 * @example
 * import {
 *   Edit,
 *   SimpleForm,
 *   DateInput,
 *   TextInput,
 * } from '@/components/admin';
 *
 * const PostEdit = () => (
 *   <Edit>
 *     <SimpleForm>
 *       <TextInput source="title" />
 *       <DateInput source="published_at" />
 *       <DateInput source="expires_at" />
 *     </SimpleForm>
 *   </Edit>
 * );
 *
 * @example
 * // If the initial value string contains more than a date (e.g. an hour, a timezone),
 * // these details are ignored.
 * <DateInput source="published_at" defaultValue="2021-09-11T20:46:20.000-04:00" />
 * // The input will display '2021-09-11' regardless of the browser timezone.
 *
 * @example
 * // If the initial value is a Date object, DateInput converts it to a string
 * // and ignores the timezone.
 * <DateInput source="published_at" defaultValue={new Date("2021-09-11T20:46:20.000-04:00")} />
 * // The input will display '2021-09-11' regardless of the browser timezone.
 *
 * @example
 * // If you want to manipulate the value from the field to adjust its timezone, use the format prop
 * <DateInput source="published_at" format={value => new Date(value).toISOString().split("T")[0]} />
 * // The input will display the UTC day regardless of the browser timezone.
 *
 * @example
 * // If you want the returned value to be a Date, you must pass a custom parse method
 * // to convert the form value (which is always a date string) back to a Date object.
 * <DateInput source="published_at" parse={val => new Date(val)} />
 */
export const DateInput = (props: DateInputProps) => {
  const {
    className,
    inputClassName,
    defaultValue,
    format = defaultFormat,
    label,
    source,
    helperText,
    onChange,
    onFocus,
    validate,
    disabled,
    readOnly,
    ...rest
  } = props;

  const resource = useResourceContext(props);

  const {
    field,
    fieldState: _fieldState,
    id,
    isRequired,
  } = useInput({
    defaultValue,
    source,
    validate,
    disabled,
    readOnly,
    format,
    ...rest,
  });
  const localInputRef = React.useRef<HTMLInputElement>(null);
  // DateInput is not a really controlled input to ensure users can start entering a date, go to another input and come back to complete it.
  // This ref stores the value that is passed to the input defaultValue prop to solve this issue.
  const initialDefaultValueRef = React.useRef(field.value);
  // As the defaultValue prop won't trigger a remount of the HTML input, we will force it by changing the key.
  const [inputKey, setInputKey] = React.useState(1);
  // This ref let us track that the last change of the form state value was made by the input itself
  const wasLastChangedByInput = React.useRef(false);

  // This effect ensures we stays in sync with the react-hook-form state when the value changes from outside the input
  // for instance by using react-hook-form reset or setValue methods.
  React.useEffect(() => {
    // Ignore react-hook-form state changes if it came from the input itself
    if (wasLastChangedByInput.current) {
      // Resets the flag to ensure futures changes are handled
      wasLastChangedByInput.current = false;
      return;
    }

    const hasNewValueFromForm =
      localInputRef.current?.value !== field.value &&
      !(localInputRef.current?.value === "" && field.value == null);

    if (hasNewValueFromForm) {
      // The value has changed from outside the input, we update the input value
      initialDefaultValueRef.current = field.value;
      // Trigger a remount of the HTML input
      setInputKey((r) => r + 1);
      // Resets the flag to ensure futures changes are handled
      wasLastChangedByInput.current = false;
    }
  }, [setInputKey, field.value]);

  const { onBlur: onBlurFromField } = field;
  const hasFocus = React.useRef(false);

  // Update the input text when the user types in the input.
  // Also, update the react-hook-form value if the input value is a valid date string.
  const handleChange = useEvent(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(event);
      }
      if (
        typeof event.target === "undefined" ||
        typeof event.target.value === "undefined"
      ) {
        return;
      }
      const target = event.target;
      const newValue = target.value;
      const isNewValueValid =
        newValue === "" ||
        (target.valueAsDate != null &&
          !isNaN(new Date(target.valueAsDate).getTime()));

      // Some browsers will return null for an invalid date
      // so we only change react-hook-form value if it's not null.
      // The input reset is handled in the onBlur event handler
      if (newValue !== "" && newValue != null && isNewValueValid) {
        field.onChange(newValue);
        // Track the fact that the next react-hook-form state change was triggered by the input itself
        wasLastChangedByInput.current = true;
      }
    },
  );

  const handleFocus = useEvent((event: React.FocusEvent<HTMLInputElement>) => {
    if (onFocus) {
      onFocus(event);
    }
    hasFocus.current = true;
  });

  const handleBlur = useEvent(() => {
    hasFocus.current = false;

    if (!localInputRef.current) {
      return;
    }

    const newValue = localInputRef.current.value;
    // To ensure users can clear the input, we check its value on blur
    // and submit it to react-hook-form
    const isNewValueValid =
      newValue === "" ||
      (localInputRef.current.valueAsDate != null &&
        !isNaN(new Date(localInputRef.current.valueAsDate).getTime()));

    if (isNewValueValid && field.value !== newValue) {
      field.onChange(newValue ?? "");
    }

    if (onBlurFromField) {
      onBlurFromField();
    }
  });

  const { ref, name } = field;
  const inputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref && node) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      }
      localInputRef.current = node;
    },
    [ref],
  );

  return (
    <FormField id={id} className={className} name={name}>
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
          ref={inputRef}
          defaultValue={format(initialDefaultValueRef.current) ?? ""}
          key={inputKey}
          type="date"
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className={cn(
            "ra-input",
            `ra-input-${source}`,
            "[color-scheme:light] dark:[color-scheme:dark] relative [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:opacity-100",
            inputClassName,
          )}
          disabled={disabled || readOnly}
          readOnly={readOnly}
          {...rest}
        />
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};

export type DateInputProps = InputProps & {
  inputClassName?: string;
} & Omit<React.ComponentProps<"input">, "label" | "defaultValue">;

/**
 * Convert Date object to String, using the local timezone
 *
 * @param {Date} value value to convert
 * @returns {String} A standardized date (yyyy-MM-dd), to be passed to an <input type="date" />
 */
const convertDateToString = (value: Date) => {
  if (!(value instanceof Date) || isNaN(value.getDate())) return "";
  const localDate = new Date(value.getTime());
  const pad = "00";
  const yyyy = localDate.getFullYear().toString();
  const MM = (localDate.getMonth() + 1).toString();
  const dd = localDate.getDate().toString();
  return `${yyyy}-${(pad + MM).slice(-2)}-${(pad + dd).slice(-2)}`;
};

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convert a form state value to a date string for the `<input type="date">` value.
 *
 * Form state values can be anything from:
 * - a string in the "YYYY-MM-DD" format
 * - A valid date string
 * - an ISO date string
 * - a Date object
 * - a Linux timestamp
 * - an empty string
 *
 * When it's not a bare date string (YYYY-MM-DD), the value is converted to
 * this format using the JS Date object.
 * THIS MAY CHANGE THE DATE VALUE depending on the browser locale.
 * For example, the string "09/11/2021" may be converted to "2021-09-10"
 * in Honolulu. This is expected behavior.
 * If this is not what you want, you should provide your own parse method.
 *
 * The output is always a string in the "YYYY-MM-DD" format.
 *
 * @example
 * defaultFormat('2021-09-11'); // '2021-09-11'
 * defaultFormat('09/11/2021'); // '2021-09-11' (may change depending on the browser locale)
 * defaultFormat('2021-09-11T20:46:20.000Z'); // '2021-09-11' (may change depending on the browser locale)
 * defaultFormat(new Date('2021-09-11T20:46:20.000Z')); // '2021-09-11' (may change depending on the browser locale)
 * defaultFormat(1631385980000); // '2021-09-11' (may change depending on the browser locale)
 * defaultFormat(''); // null
 */
const defaultFormat = (value: string | Date | number) => {
  // null, undefined and empty string values should not go through dateFormatter
  // otherwise, it returns undefined and will make the input an uncontrolled one.
  if (value == null || value === "") {
    return null;
  }

  // Date objects should be converted to strings
  if (value instanceof Date) {
    return convertDateToString(value);
  }

  // Valid date strings (YYYY-MM-DD) should be considered as is
  if (typeof value === "string") {
    if (dateRegex.test(value)) {
      return value;
    }
  }

  // other values (e.g., localized date strings, timestamps) need to be converted to Dates first
  return convertDateToString(new Date(value));
};
