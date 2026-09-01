import * as React from "react";
import type { InputProps } from "ra-core";
import { useInput, FieldTitle, useResourceContext } from "ra-core";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { InputHelperText } from "@/components/admin/input-helper-text";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFnsJalali } from "@mui/x-date-pickers/AdapterDateFnsJalali";

export type JalaliDateInputProps = InputProps & {
  inputClassName?: string;
} & Omit<React.ComponentProps<typeof DatePicker>, "label" | "defaultValue" | "onChange">;

export const JalaliDateInput = (props: JalaliDateInputProps) => {
  const {
    className,
    inputClassName,
    defaultValue,
    label,
    source,
    helperText,
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
    ...rest,
  });

  const handleChange = (date: Date | null) => {
    if (date && !isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      field.onChange(`${year}-${month}-${day}`);
    } else {
      field.onChange("");
    }
  };

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
        <LocalizationProvider dateAdapter={AdapterDateFnsJalali}>
          <DatePicker
            value={field.value ? new Date(field.value) : null}
            onChange={handleChange}
            disabled={disabled || readOnly}
            readOnly={readOnly}
            slotProps={{
              textField: {
                className: `w-full ${inputClassName || ""}`,
                sx: {
                  width: "100%",
                  "& .MuiPickersOutlinedInput-notchedOutline": {
                    display: "none",
                  },
                  "& .MuiPickersOutlinedInput-root": {
                    backgroundColor: "transparent",
                    borderRadius: "calc(var(--radius) - 4px)",
                    border: "1px solid var(--input)",
                    boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
                    transition: "color 0.2s, box-shadow 0.2s, border-color 0.2s",
                    "&:hover": {
                      borderColor: "var(--ring)",
                    },
                    "&.Mui-focused": {
                      borderColor: "var(--ring)",
                      boxShadow: "0 0 0 3px color-mix(in srgb, var(--ring) 50%, transparent)",
                    },
                  },
                  // اعمال پدینگی که خودت پیدا کردی روی کانتینر اصلی بخش‌های تاریخ
                  "& .MuiPickersInputBase-sectionsContainer": {
                    padding: "6px 0", 
                    fontFamily: "inherit",
                  },
                  // تنظیم استایل‌های فونت و پدینگ لایه داخلی
                  "& .MuiPickersInputBase-input": {
                    padding: "0", // پدینگ این بخش را صفر کردیم چون روی کانتینر اعمال شد
                    height: "1.25rem",
                    fontSize: "0.875rem",
                    fontFamily: "inherit",
                    color: "var(--foreground)",
                  },
                  "& .MuiIconButton-root": {
                    color: "var(--muted-foreground)",
                    padding: "4px",
                    marginRight: "4px",
                  }
                }
              },
              previousIconButton: { sx: { transform: 'scaleX(-1)' } },
              nextIconButton: { sx: { transform: 'scaleX(-1)' } },
              popper: {
                sx: {
                  pointerEvents: 'auto',
                  zIndex: 999999,
                  "& .MuiPaper-root": {
                    fontFamily: "inherit",
                  }
                }
              }
            }}
            {...rest}
          />
        </LocalizationProvider>
      </FormControl>
      <InputHelperText helperText={helperText} />
      <FormError />
    </FormField>
  );
};