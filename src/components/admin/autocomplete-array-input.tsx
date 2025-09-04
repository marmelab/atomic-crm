import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import { Command as CommandPrimitive } from "cmdk";
import {
  ChoicesProps,
  InputProps,
  useChoices,
  useChoicesContext,
  useGetRecordRepresentation,
  useInput,
  useTranslate,
  FieldTitle,
  useEvent,
} from "ra-core";
import { InputHelperText } from "./input-helper-text";
import { useCallback } from "react";

export const AutocompleteArrayInput = (
  props: Omit<InputProps, "source"> &
    Partial<Pick<InputProps, "source">> &
    ChoicesProps & {
      className?: string;
      disableValue?: string;
      filterToQuery?: (searchText: string) => any;
      translateChoice?: boolean;
      placeholder?: string;
      inputText?:
        | React.ReactNode
        | ((option: any | undefined) => React.ReactNode);
    },
) => {
  const { filterToQuery = DefaultFilterToQuery, inputText } = props;
  const {
    allChoices = [],
    source,
    resource,
    isFromReference,
    setFilters,
  } = useChoicesContext(props);
  const { id, field, isRequired } = useInput({ ...props, source });
  const translate = useTranslate();
  const { placeholder = translate("ra.action.search", { _: "Search..." }) } =
    props;

  const getRecordRepresentation = useGetRecordRepresentation(resource);
  const { getChoiceText, getChoiceValue } = useChoices({
    optionText:
      props.optionText ?? (isFromReference ? getRecordRepresentation : "name"),
    optionValue: props.optionValue ?? "id",
    disableValue: props.disableValue,
    translateChoice: props.translateChoice ?? !isFromReference,
  });

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState(false);

  const handleUnselect = useEvent((choice: any) => {
    field.onChange(
      field.value.filter((v: any) => v !== getChoiceValue(choice)),
    );
  });

  const handleKeyDown = useEvent((e: React.KeyboardEvent<HTMLDivElement>) => {
    const input = inputRef.current;
    if (input) {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (input.value === "") {
          field.onChange(field.value.slice(0, -1));
        }
      }
      // This is not a default behavior of the <input /> field
      if (e.key === "Escape") {
        input.blur();
      }
    }
  });

  const availableChoices = allChoices.filter(
    (choice) => !field.value.includes(getChoiceValue(choice)),
  );
  const selectedChoices = allChoices.filter((choice) =>
    field.value.includes(getChoiceValue(choice)),
  );
  const [filterValue, setFilterValue] = React.useState("");

  const getInputText = useCallback(
    (selectedChoice: any) => {
      if (typeof inputText === "function") {
        return inputText(selectedChoice);
      }
      if (inputText !== undefined) {
        return inputText;
      }
      return getChoiceText(selectedChoice);
    },
    [inputText, getChoiceText],
  );

  return (
    <FormField className={props.className} id={id} name={field.name}>
      {props.label !== false && (
        <FormLabel>
          <FieldTitle
            label={props.label}
            source={props.source ?? source}
            resource={resource}
            isRequired={isRequired}
          />
        </FormLabel>
      )}
      <FormControl>
        <Command
          onKeyDown={handleKeyDown}
          shouldFilter={!isFromReference}
          className="overflow-visible bg-transparent"
        >
          <div className="group rounded-md bg-transparent dark:bg-input/30 border border-input px-3 py-1.75 text-sm transition-all ring-offset-background focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]">
            <div className="flex flex-wrap gap-1">
              {selectedChoices.map((choice) => (
                <Badge key={getChoiceValue(choice)} variant="outline">
                  {getInputText(choice)}
                  <button
                    className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleUnselect(choice);
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      handleUnselect(choice);
                    }}
                  >
                    <span className="sr-only">
                      {translate("ra.action.remove", {
                        _: "Remove",
                      })}
                    </span>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {/* Avoid having the "Search" Icon by not using CommandInput */}
              <CommandPrimitive.Input
                ref={inputRef}
                value={filterValue}
                onValueChange={(filter) => {
                  setFilterValue(filter);
                  // We don't want the ChoicesContext to filter the choices if the input
                  // is not from a reference as it would also filter out the selected values
                  if (isFromReference) {
                    setFilters(filterToQuery(filter), undefined, true);
                  }
                }}
                onBlur={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                placeholder={placeholder}
                className="ml-2 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="relative">
            <CommandList>
              {open && availableChoices.length > 0 ? (
                <div className="absolute top-2 z-10 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
                  <CommandGroup className="h-full overflow-auto">
                    {availableChoices.map((choice) => {
                      return (
                        <CommandItem
                          key={getChoiceValue(choice)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onSelect={() => {
                            setFilterValue("");
                            if (isFromReference) {
                              setFilters(filterToQuery(""));
                            }
                            field.onChange([
                              ...field.value,
                              getChoiceValue(choice),
                            ]);
                          }}
                          className="cursor-pointer"
                        >
                          {getChoiceText(choice)}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </div>
              ) : null}
            </CommandList>
          </div>
        </Command>
      </FormControl>
      <InputHelperText helperText={props.helperText} />
      <FormError />
    </FormField>
  );
};

const DefaultFilterToQuery = (searchText: string) => ({ q: searchText });
