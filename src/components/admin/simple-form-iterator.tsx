/* eslint-disable @typescript-eslint/no-explicit-any */
import get from "lodash/get";
import * as React from "react";
import type { ReactElement } from "react";
import { useState } from "react";
import type {
  RaRecord,
  SimpleFormIteratorDisableRemoveFunction,
  SimpleFormIteratorItemBaseProps,
} from "ra-core";
import {
  RecordContextProvider,
  SimpleFormIteratorBase,
  SimpleFormIteratorItemBase,
  useArrayInput,
  useEvent,
  useGetArrayInputNewItemDefaults,
  useRecordContext,
  useResourceContext,
  useSimpleFormIterator,
  useSimpleFormIteratorItem,
  useTranslate,
  useWrappedSource,
} from "ra-core";
import type { UseFieldArrayReturn } from "react-hook-form";
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

/**
 * An array input iterator for managing dynamic lists of items in forms.
 *
 * Renders a list of form items with add, remove, and reorder controls. Use inside ArrayInput
 * for arrays of objects or scalar values. Supports inline layouts and custom buttons.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/arrayinput/ ArrayInput documentation}
 *
 * @example
 * import { ArrayInput, SimpleFormIterator, TextInput } from '@/components/admin';
 *
 * const PostEdit = () => (
 *   <ArrayInput source="authors">
 *     <SimpleFormIterator>
 *       <TextInput source="name" />
 *       <TextInput source="email" />
 *     </SimpleFormIterator>
 *   </ArrayInput>
 * );
 */
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

  const { fields } = useArrayInput(props);
  const record = useRecordContext(props);

  const records = get(record, finalSource);
  const getArrayInputNewItemDefaults = useGetArrayInputNewItemDefaults(fields);

  const getItemDefaults = useEvent((item: any = undefined) => {
    if (item != null) return item;
    return getArrayInputNewItemDefaults(children);
  });

  return fields ? (
    <SimpleFormIteratorBase getItemDefaults={getItemDefaults} {...props}>
      <div className={cn("w-full", disabled && "disabled", className)}>
        <ul className="p-0 m-0 flex flex-col gap-2">
          {fields.map((member, index) => (
            <RecordContextProvider
              key={member.id}
              value={(records && records[index]) || {}}
            >
              <SimpleFormIteratorItem
                disabled={disabled}
                disableRemove={disableRemove}
                disableReordering={disableReordering}
                fields={fields}
                getItemLabel={getItemLabel}
                index={index}
                removeButton={removeButton}
                reOrderButtons={reOrderButtons}
                resource={resource}
                inline={inline}
              >
                {children}
              </SimpleFormIteratorItem>
            </RecordContextProvider>
          ))}
        </ul>
        {!disabled && !(disableAdd && (disableClear || disableRemove)) && (
          <div className="flex flex-row items-center gap-2">
            {!disableAdd && addButton}
            {fields.length > 0 && !disableClear && !disableRemove && (
              <SimpleFormIteratorClearButton />
            )}
          </div>
        )}
      </div>
    </SimpleFormIteratorBase>
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
  disableRemove?: boolean | SimpleFormIteratorDisableRemoveFunction;
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

/**
 * A single item in a SimpleFormIterator list with controls.
 *
 * Renders one item from an array with its input fields and action buttons (remove, reorder).
 * Usually used internally by SimpleFormIterator but can be customized.
 *
 * @example
 * import { SimpleFormIteratorItem } from '@/components/admin';
 *
 * // Typically used internally by SimpleFormIterator
 */
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
      removeButton = defaultRemoveItemButton,
      reOrderButtons = defaultReOrderButtons,
    } = props;
    const resource = useResourceContext(props);
    if (!resource) {
      throw new Error(
        "SimpleFormIteratorItem must be used in a ResourceContextProvider or be passed a resource prop.",
      );
    }
    const record = useRecordContext(props);
    if (!record) {
      throw new Error(
        "SimpleFormIteratorItem must be used in a RecordContextProvider.",
      );
    }
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

    const label =
      typeof getItemLabel === "function" ? getItemLabel(index) : getItemLabel;

    return (
      <SimpleFormIteratorItemBase {...props}>
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
          <div
            className={cn(
              "flex flex-1 gap-2",
              inline ? "flex-col sm:flex-row gap-2" : "flex-col",
            )}
          >
            {children}
          </div>
          {!disabled && (
            <div className="simple-form-iterator-item-actions flex flex-row h-9 items-center gap-1">
              {!disableReordering && reOrderButtons}
              {!disableRemoveField(record) && removeButton}
            </div>
          )}
        </li>
      </SimpleFormIteratorItemBase>
    );
  },
);

export interface SimpleFormIteratorItemProps
  extends SimpleFormIteratorItemBaseProps {
  disabled?: boolean;
  disableRemove?: boolean | SimpleFormIteratorDisableRemoveFunction;
  disableReordering?: boolean;
  getItemLabel?: boolean | GetItemLabelFunc;
  inline?: boolean;
  removeButton?: ReactElement;
  reOrderButtons?: ReactElement;
}

/**
 * A button to add new items to a SimpleFormIterator.
 *
 * Renders a plus icon button that appends a new item to the array. Works with the
 * SimpleFormIterator context to add items with default values.
 *
 * @example
 * import { ArrayInput, SimpleFormIterator, AddItemButton } from '@/components/admin';
 *
 * const PostEdit = () => (
 *     <ArrayInput source="tags">
 *         <SimpleFormIterator addButton={<AddItemButton />}>
 *             ...
 *         </SimpleFormIterator>
 *     </ArrayInput>
 * );
 */
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

/**
 * Up and down buttons for reordering items in a SimpleFormIterator.
 *
 * Renders arrow buttons that move an item up or down in the list. Used internally
 * by SimpleFormIterator but can be customized.
 *
 * @example
 * import { SimpleFormIterator, ReOrderButtons } from '@/components/admin';
 *
 * const PostEdit = () => (
 *     <SimpleFormIterator reOrderButtons={<ReOrderButtons />}>
 *         ...
 *     </SimpleFormIterator>
 * );
 */
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

export const SimpleFormIteratorClearButton = ({
  className,
  disableClear,
  disableRemove,
}: SimpleFormIteratorClearButtonProp) => {
  const translate = useTranslate();
  const [confirmIsOpen, setConfirmIsOpen] = useState<boolean>(false);
  const { clear, total } = useSimpleFormIterator();

  const handleArrayClear = useEvent(() => {
    clear();
    setConfirmIsOpen(false);
  });

  if (total === 0 || disableClear === true || disableRemove === true) {
    return null;
  }

  return (
    <>
      <Confirm
        isOpen={confirmIsOpen}
        title={translate("ra.action.clear_array_input")}
        content={translate("ra.message.clear_array_input")}
        onConfirm={handleArrayClear}
        onClose={() => setConfirmIsOpen(false)}
      />
      <ClearArrayButton
        className={className}
        onClick={() => setConfirmIsOpen(true)}
      />
    </>
  );
};

export interface SimpleFormIteratorClearButtonProp {
  className?: string;
  disableClear?: boolean;
  disableRemove?: boolean | SimpleFormIteratorDisableRemoveFunction;
}

/**
 * A button to clear all items from a SimpleFormIterator.
 *
 * Renders a trash icon button that removes all items from the array after confirmation.
 * Used internally by SimpleFormIterator when disableClear is false.
 *
 * @example
 * import { ClearArrayButton } from '@/components/admin';
 *
 * // Typically used internally by SimpleFormIterator
 */
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

/**
 * A button to remove a single item from a SimpleFormIterator.
 *
 * Renders a close icon button that removes the current item from the array. Used internally
 * by SimpleFormIterator for each item when disableRemove is false.
 *
 * @example
 * import { SimpleFormIterator, RemoveItemButton } from '@/components/admin';
 *
 * const PostEdit = () => (
 *     <SimpleFormIterator removeButton={<RemoveItemButton />}>
 *         ...
 *     </SimpleFormIterator>
 * );
 */
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
