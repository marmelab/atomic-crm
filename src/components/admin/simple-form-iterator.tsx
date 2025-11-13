import get from "lodash/get";
import * as React from "react";
import type { ReactElement, ReactNode } from "react";
import { Children, useCallback, useMemo, useRef, useState } from "react";
import type {
  ArrayInputContextValue,
  RaRecord,
  SimpleFormIteratorItemContextValue,
} from "ra-core";
import {
  FormDataConsumer,
  RecordContextProvider,
  SimpleFormIteratorContext,
  SimpleFormIteratorItemContext,
  SourceContextProvider,
  useArrayInput,
  useRecordContext,
  useResourceContext,
  useSimpleFormIterator,
  useSimpleFormIteratorItem,
  useSourceContext,
  useTranslate,
  useWrappedSource,
} from "ra-core";
import type { UseFieldArrayReturn } from "react-hook-form";
import { useFormContext } from "react-hook-form";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  PlusCircle,
  Trash,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Confirm } from "@/components/admin/confirm";
import { IconButtonWithTooltip } from "@/components/admin/icon-button-with-tooltip";

type GetItemLabelFunc = (index: number) => string | ReactElement;

export const SimpleFormIterator = (props: SimpleFormIteratorProps) => {
  const {
    addButton = defaultAddItemButton,
    removeButton,
    reOrderButtons,
    children,
    className,
    resource,
    disabled,
    disableAdd = false,
    disableClear,
    disableRemove = false,
    disableReordering,
    inline,
    getItemLabel = false,
  } = props;

  const finalSource = useWrappedSource("");
  if (!finalSource) {
    throw new Error(
      "SimpleFormIterator can only be called within an iterator input like ArrayInput",
    );
  }

  const [confirmIsOpen, setConfirmIsOpen] = useState<boolean>(false);
  const { append, fields, move, remove, replace } = useArrayInput(props);
  const { trigger, getValues } = useFormContext();
  const translate = useTranslate();
  const record = useRecordContext(props);
  const initialDefaultValue = useRef({});

  const removeField = useCallback(
    (index: number) => {
      remove(index);
      const isScalarArray = getValues(finalSource).every(
        (value: any) => typeof value !== "object",
      );
      if (isScalarArray) {
        // Trigger validation on the Array to avoid ghost errors.
        // Otherwise, validation errors on removed fields might still be displayed
        trigger(finalSource);
      }
    },
    [remove, trigger, finalSource, getValues],
  );

  if (fields.length > 0) {
    const { id: _id, ...rest } = fields[0];
    initialDefaultValue.current = rest;
    for (const k in initialDefaultValue.current) {
      // @ts-expect-error: reset fields
      initialDefaultValue.current[k] = null;
    }
  }

  const addField = useCallback(
    (item: any = undefined) => {
      let defaultValue = item;
      if (item == null) {
        defaultValue = initialDefaultValue.current;
        if (
          Children.count(children) === 1 &&
          React.isValidElement(Children.only(children)) &&
          // @ts-expect-error: Check if the child has a source prop
          !Children.only(children).props.source &&
          // Make sure it's not a FormDataConsumer
          // @ts-expect-error: Check if the child is a FormDataConsumer
          Children.only(children).type !== FormDataConsumer
        ) {
          // ArrayInput used for an array of scalar values
          // (e.g. tags: ['foo', 'bar'])
          defaultValue = "";
        } else {
          // ArrayInput used for an array of objects
          // (e.g. authors: [{ firstName: 'John', lastName: 'Doe' }, { firstName: 'Jane', lastName: 'Doe' }])
          defaultValue = defaultValue || ({} as Record<string, unknown>);
          Children.forEach(children, (input) => {
            if (
              React.isValidElement(input) &&
              input.type !== FormDataConsumer &&
              // @ts-expect-error: Check if the child has a source prop
              input.props.source
            ) {
              // @ts-expect-error: Check if the child has a source prop
              defaultValue[input.props.source] =
                // @ts-expect-error: Check if the child has a source prop
                input.props.defaultValue ?? null;
            }
          });
        }
      }
      append(defaultValue);
    },
    [append, children],
  );

  const handleReorder = useCallback(
    (origin: number, destination: number) => {
      move(origin, destination);
    },
    [move],
  );

  const handleArrayClear = useCallback(() => {
    replace([]);
    setConfirmIsOpen(false);
  }, [replace]);

  const records = get(record, finalSource);

  const context = useMemo(
    () => ({
      total: fields.length,
      add: addField,
      remove: removeField,
      reOrder: handleReorder,
      source: finalSource,
    }),
    [addField, fields.length, handleReorder, removeField, finalSource],
  );
  return fields ? (
    <SimpleFormIteratorContext.Provider value={context}>
      <div className={cn("w-full", disabled && "disabled", className)}>
        <ul className="p-0 m-0 flex flex-col gap-2">
          {fields.map((member, index) => (
            <SimpleFormIteratorItem
              key={member.id}
              disabled={disabled}
              disableRemove={disableRemove}
              disableReordering={disableReordering}
              fields={fields}
              getItemLabel={getItemLabel}
              index={index}
              onRemoveField={removeField}
              onReorder={handleReorder}
              record={(records && records[index]) || {}}
              removeButton={removeButton}
              reOrderButtons={reOrderButtons}
              resource={resource}
              inline={inline}
            >
              {children}
            </SimpleFormIteratorItem>
          ))}
        </ul>
        {!disabled && !(disableAdd && (disableClear || disableRemove)) && (
          <div className="flex flex-row items-center gap-2">
            {!disableAdd && addButton}
            {fields.length > 0 && !disableClear && !disableRemove && (
              <>
                <Confirm
                  isOpen={confirmIsOpen}
                  title={translate("ra.action.clear_array_input")}
                  content={translate("ra.message.clear_array_input")}
                  onConfirm={handleArrayClear}
                  onClose={() => setConfirmIsOpen(false)}
                />
                <ClearArrayButton onClick={() => setConfirmIsOpen(true)} />
              </>
            )}
          </div>
        )}
      </div>
    </SimpleFormIteratorContext.Provider>
  ) : null;
};

export interface SimpleFormIteratorProps extends Partial<UseFieldArrayReturn> {
  addButton?: ReactElement;
  children?: ReactElement | ReactElement[];
  className?: string;
  readOnly?: boolean;
  disabled?: boolean;
  disableAdd?: boolean;
  disableClear?: boolean;
  disableRemove?: boolean | DisableRemoveFunction;
  disableReordering?: boolean;
  fullWidth?: boolean;
  getItemLabel?: boolean | GetItemLabelFunc;
  inline?: boolean;
  meta?: {
    // the type defined in FieldArrayRenderProps says error is boolean, which is wrong.
    error?: any;
    submitFailed?: boolean;
  };
  record?: RaRecord;
  removeButton?: ReactElement;
  reOrderButtons?: ReactElement;
  resource?: string;
  source?: string;
}

export const SimpleFormIteratorItem = React.forwardRef(
  (
    props: SimpleFormIteratorItemProps,
    ref: React.ForwardedRef<HTMLLIElement>,
  ) => {
    const {
      children,
      disabled,
      disableReordering,
      disableRemove,
      getItemLabel,
      index,
      inline,
      record,
      removeButton = defaultRemoveItemButton,
      reOrderButtons = defaultReOrderButtons,
    } = props;
    const resource = useResourceContext(props);
    if (!resource) {
      throw new Error(
        "SimpleFormIteratorItem must be used in a ResourceContextProvider or be passed a resource prop.",
      );
    }
    const { total, reOrder, remove } = useSimpleFormIterator();
    // Returns a boolean to indicate whether to disable the remove button for certain fields.
    // If disableRemove is a function, then call the function with the current record to
    // determining if the button should be disabled. Otherwise, use a boolean property that
    // enables or disables the button for all of the fields.
    const disableRemoveField = (record: RaRecord) => {
      if (typeof disableRemove === "boolean") {
        return disableRemove;
      }
      return disableRemove && disableRemove(record);
    };

    const context = useMemo<SimpleFormIteratorItemContextValue>(
      () => ({
        index,
        total,
        reOrder: (newIndex) => reOrder(index, newIndex),
        remove: () => remove(index),
      }),
      [index, total, reOrder, remove],
    );

    const label =
      typeof getItemLabel === "function" ? getItemLabel(index) : getItemLabel;

    const parentSourceContext = useSourceContext();
    const sourceContext = useMemo(
      () => ({
        getSource: (source: string) => {
          if (!source) {
            // source can be empty for scalar values, e.g.
            // <ArrayInput source="tags" /> => SourceContext is "tags"
            //   <SimpleFormIterator> => SourceContext is "tags.0"
            //      <TextInput /> => use its parent's getSource so finalSource = "tags.0"
            //   </SimpleFormIterator>
            // </ArrayInput>
            return parentSourceContext.getSource(`${index}`);
          } else {
            // Normal input with source, e.g.
            // <ArrayInput source="orders" /> => SourceContext is "orders"
            //   <SimpleFormIterator> => SourceContext is "orders.0"
            //      <DateInput source="date" /> => use its parent's getSource so finalSource = "orders.0.date"
            //   </SimpleFormIterator>
            // </ArrayInput>
            return parentSourceContext.getSource(`${index}.${source}`);
          }
        },
        getLabel: (source: string) => {
          // <ArrayInput source="orders" /> => LabelContext is "orders"
          //   <SimpleFormIterator> => LabelContext is ALSO "orders"
          //      <DateInput source="date" /> => use its parent's getLabel so finalLabel = "orders.date"
          //   </SimpleFormIterator>
          // </ArrayInput>
          //
          // we don't prefix with the index to avoid that translation keys contain it
          return parentSourceContext.getLabel(source);
        },
      }),
      [index, parentSourceContext],
    );

    return (
      <SimpleFormIteratorItemContext.Provider value={context}>
        <li
          ref={ref}
          className={cn(
            "flex flex-row items-start justify-between gap-2 pb-2 border-b border-border last:border-b-0",
            // Align the buttons with the input
            "[&:has(label)>.simple-form-iterator-item-actions]:pt-10",
          )}
        >
          {label != null && label !== false && (
            <p className="text-sm text-muted-foreground mb-2">{label}</p>
          )}
          <SourceContextProvider value={sourceContext}>
            <RecordContextProvider value={record}>
              <div
                className={cn(
                  "flex flex-1 gap-2",
                  inline ? "flex-col sm:flex-row gap-2" : "flex-col",
                )}
              >
                {children}
              </div>
            </RecordContextProvider>
          </SourceContextProvider>
          {!disabled && (
            <div className="simple-form-iterator-item-actions flex flex-row h-9 items-center gap-1">
              {!disableReordering && reOrderButtons}
              {!disableRemoveField(record) && removeButton}
            </div>
          )}
        </li>
      </SimpleFormIteratorItemContext.Provider>
    );
  },
);

export type DisableRemoveFunction = (record: RaRecord) => boolean;

export type SimpleFormIteratorItemProps = Partial<ArrayInputContextValue> & {
  children?: ReactNode;
  disabled?: boolean;
  disableRemove?: boolean | DisableRemoveFunction;
  disableReordering?: boolean;
  getItemLabel?: boolean | GetItemLabelFunc;
  index: number;
  inline?: boolean;
  onRemoveField: (index: number) => void;
  onReorder: (origin: number, destination: number) => void;
  record: RaRecord;
  removeButton?: ReactElement;
  reOrderButtons?: ReactElement;
  resource?: string;
  source?: string;
};

export const AddItemButton = (props: React.ComponentProps<"button">) => {
  const { add, source } = useSimpleFormIterator();
  const { className, ...rest } = props;
  const translate = useTranslate();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => add()}
            className={cn("button-add", `button-add-${source}`, className)}
            {...rest}
          >
            <PlusCircle className="h-5 w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{translate("ra.action.add")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const ReOrderButtons = ({ className }: { className?: string }) => {
  const { index, total, reOrder } = useSimpleFormIteratorItem();
  const { source } = useSimpleFormIterator();

  return (
    <span
      className={cn(
        "button-reorder",
        `button-reorder-${source}-${index}`,
        className,
      )}
    >
      <IconButtonWithTooltip
        label="ra.action.move_up"
        onClick={() => reOrder(index - 1)}
        disabled={index <= 0}
      >
        <ArrowUpCircle className="h-4 w-4" />
      </IconButtonWithTooltip>
      <IconButtonWithTooltip
        label="ra.action.move_down"
        onClick={() => reOrder(index + 1)}
        disabled={total == null || index >= total - 1}
      >
        <ArrowDownCircle className="h-4 w-4" />
      </IconButtonWithTooltip>
    </span>
  );
};

export const ClearArrayButton = (props: React.ComponentProps<"button">) => {
  const translate = useTranslate();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon" {...props}>
            <Trash className="h-5 w-5 text-red-500" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {translate("ra.action.clear_array_input")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const RemoveItemButton = (props: React.ComponentProps<"button">) => {
  const { remove, index } = useSimpleFormIteratorItem();
  const { source } = useSimpleFormIterator();
  const { className, ...rest } = props;
  const translate = useTranslate();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove()}
            className={cn(
              "button-remove",
              `button-remove-${source}-${index}`,
              className,
            )}
            {...rest}
          >
            <XCircle className="h-5 w-5 text-red-500" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{translate("ra.action.remove")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const defaultAddItemButton = <AddItemButton />;
const defaultRemoveItemButton = <RemoveItemButton />;
const defaultReOrderButtons = <ReOrderButtons />;
