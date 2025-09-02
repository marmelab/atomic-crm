 
import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  FormControl,
  FormError,
  FormField,
  FormLabel,
} from "@/components/admin/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

export const AutocompleteInput = (
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

  const [filterValue, setFilterValue] = React.useState("");

  const [open, setOpen] = React.useState(false);
  const selectedChoice = allChoices.find(
    (choice) => getChoiceValue(choice) === field.value,
  );

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

  const handleOpenChange = useEvent((isOpen: boolean) => {
    setOpen(isOpen);
    // Reset the filter when the popover is closed
    if (!isOpen) {
      setFilters(filterToQuery(""));
    }
  });

  return (
    <FormField className={props.className} id={id} name={source}>
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
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between h-auto py-1.75 font-normal"
            >
              {selectedChoice ? (
                getInputText(selectedChoice)
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            {/* We handle the filtering ourselves */}
            <Command shouldFilter={!isFromReference}>
              <CommandInput
                placeholder="Search..."
                value={filterValue}
                onValueChange={(filter) => {
                  setFilterValue(filter);
                  // We don't want the ChoicesContext to filter the choices if the input
                  // is not from a reference as it would also filter out the selected values
                  if (isFromReference) {
                    setFilters(filterToQuery(filter));
                  }
                }}
              />
              <CommandEmpty>No matching item found.</CommandEmpty>
              <CommandGroup>
                {allChoices.map((choice) => (
                  <CommandItem
                    key={getChoiceValue(choice)}
                    value={getChoiceValue(choice)}
                    onSelect={() => {
                      if (
                        field.value === getChoiceValue(choice) &&
                        !isRequired
                      ) {
                        field.onChange("");
                        setFilterValue("");
                        if (isFromReference) {
                          setFilters(filterToQuery(""));
                        }
                        setOpen(false);
                        return;
                      }
                      field.onChange(getChoiceValue(choice));
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        field.value === getChoiceValue(choice)
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    {getChoiceText(choice)}
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      </FormControl>
      <InputHelperText helperText={props.helperText} />
      <FormError />
    </FormField>
  );
};

const DefaultFilterToQuery = (searchText: string) => ({ q: searchText });
