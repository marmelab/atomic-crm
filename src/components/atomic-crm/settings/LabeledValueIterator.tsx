import {
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  Pencil,
  PlusCircle,
  XCircle,
} from "lucide-react";
import * as React from "react";
import { useRef, useState } from "react";
import type { RaRecord } from "ra-core";
import {
  RecordContextProvider,
  SimpleFormIteratorBase,
  SimpleFormIteratorItemBase,
  useArrayInput,
  useEvent,
  useInput,
  useSimpleFormIterator,
  useSimpleFormIteratorItem,
  useWrappedSource,
} from "ra-core";
import type { UseFieldArrayReturn } from "react-hook-form";
import { useFormContext } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconButtonWithTooltip } from "@/components/admin/icon-button-with-tooltip";

/**
 * Derive a stable slug value from a display label.
 * e.g. "Communication Services" → "communication-services"
 */
const toSlug = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * A form iterator for arrays of `{ value, label, ...extras }` objects.
 *
 * Designed as a drop-in replacement for `SimpleFormIterator` inside `ArrayInput`.
 * Each row shows the label in view mode with an edit toggle. The `value` field is
 * auto-generated from the label (via slug) for new items and preserved for existing ones.
 *
 * Supports optional extra fields (e.g. a color picker) via `children`, which are
 * rendered as standard ra-core scoped inputs for each item.
 *
 * @example
 * // Basic usage
 * <ArrayInput source="companySectors" label={false} helperText={false}>
 *   <LabeledValueIterator placeholder="New sector" />
 * </ArrayInput>
 *
 * @example
 * // With reordering
 * <ArrayInput source="dealStages" label={false} helperText={false}>
 *   <LabeledValueIterator placeholder="New stage" reorderable />
 * </ArrayInput>
 *
 * @example
 * // With extra fields per item
 * <ArrayInput source="noteStatuses" label={false} helperText={false}>
 *   <LabeledValueIterator placeholder="New status">
 *     <ColorInput source="color" />
 *   </LabeledValueIterator>
 * </ArrayInput>
 */
export const LabeledValueIterator = (props: LabeledValueIteratorProps) => {
  const {
    children,
    className,
    disabled,
    placeholder,
    reorderable = false,
    resource,
  } = props;

  const finalSource = useWrappedSource("");
  if (!finalSource) {
    throw new Error(
      "LabeledValueIterator can only be used inside an ArrayInput",
    );
  }

  const { fields } = useArrayInput(props);
  const { getValues } = useFormContext();

  const records = getValues(finalSource);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getItemDefaults = useEvent((item: any = undefined) => {
    if (item != null) return item;
    return { value: "", label: "" };
  });

  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  return fields ? (
    <SimpleFormIteratorBase getItemDefaults={getItemDefaults} {...props}>
      <div className={cn("w-full", disabled && "disabled", className)}>
        <ul className="p-0 m-0 flex flex-col gap-1 list-none">
          {fields.map((member, index) => (
            <RecordContextProvider
              key={member.id}
              value={(records && records[index]) || {}}
            >
              <LabeledValueIteratorItem
                disabled={disabled}
                fields={fields}
                index={index}
                resource={resource}
                reorderable={reorderable}
                placeholder={placeholder}
                editingIndex={editingIndex}
                setEditingIndex={setEditingIndex}
              >
                {children}
              </LabeledValueIteratorItem>
            </RecordContextProvider>
          ))}
        </ul>
        {!disabled && (
          <LabeledValueAddButton onAdd={() => setEditingIndex(fields.length)} />
        )}
      </div>
    </SimpleFormIteratorBase>
  ) : null;
};

export interface LabeledValueIteratorProps
  extends Partial<UseFieldArrayReturn> {
  children?: React.ReactElement | React.ReactElement[];
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  reorderable?: boolean;
  record?: RaRecord;
  resource?: string;
  source?: string;
}

const LabeledValueIteratorItem = ({
  children,
  disabled,
  index,
  reorderable,
  placeholder,
  editingIndex,
  setEditingIndex,
  ...props
}: LabeledValueIteratorItemProps) => {
  const isEditing = editingIndex === index;

  return (
    <SimpleFormIteratorItemBase index={index} {...props}>
      <li className="flex items-center gap-1">
        {isEditing ? (
          <LabeledValueEditRow
            placeholder={placeholder}
            setEditingIndex={setEditingIndex}
          >
            {children}
          </LabeledValueEditRow>
        ) : (
          <LabeledValueViewRow
            index={index}
            disabled={disabled}
            reorderable={reorderable}
            setEditingIndex={setEditingIndex}
          >
            {children}
          </LabeledValueViewRow>
        )}
      </li>
    </SimpleFormIteratorItemBase>
  );
};

interface LabeledValueIteratorItemProps {
  children?: React.ReactElement | React.ReactElement[];
  disabled?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields: any;
  index: number;
  reorderable?: boolean;
  resource?: string;
  placeholder?: string;
  editingIndex: number | null;
  setEditingIndex: (index: number | null) => void;
}

/**
 * View mode: label text + extra fields + edit/reorder/remove buttons
 */
const LabeledValueViewRow = ({
  children,
  disabled,
  index,
  reorderable,
  setEditingIndex,
}: {
  children?: React.ReactElement | React.ReactElement[];
  disabled?: boolean;
  index: number;
  reorderable?: boolean;
  setEditingIndex: (index: number | null) => void;
}) => {
  const {
    field: { value: label },
  } = useInput({ source: "label" });
  const { remove, reOrder, total } = useSimpleFormIteratorItem();

  return (
    <>
      <span className="flex-1 text-sm px-3 py-1 truncate">
        {label || <span className="text-muted-foreground italic">(empty)</span>}
      </span>
      {children}
      {!disabled && (
        <>
          <IconButtonWithTooltip
            label="Edit"
            onClick={() => setEditingIndex(index)}
            className="h-8 w-8 shrink-0"
          >
            <Pencil className="h-3.5 w-3.5" />
          </IconButtonWithTooltip>
          {reorderable && (
            <>
              <IconButtonWithTooltip
                label="Move up"
                onClick={() => reOrder(index - 1)}
                disabled={index <= 0}
                className="h-8 w-8 shrink-0"
              >
                <ArrowUpCircle className="h-4 w-4" />
              </IconButtonWithTooltip>
              <IconButtonWithTooltip
                label="Move down"
                onClick={() => reOrder(index + 1)}
                disabled={total == null || index >= total - 1}
                className="h-8 w-8 shrink-0"
              >
                <ArrowDownCircle className="h-4 w-4" />
              </IconButtonWithTooltip>
            </>
          )}
          <IconButtonWithTooltip
            label="Remove"
            onClick={() => remove()}
            className="h-8 w-8 shrink-0"
          >
            <XCircle className="h-4 w-4 text-red-500" />
          </IconButtonWithTooltip>
        </>
      )}
    </>
  );
};

/**
 * Edit mode: text input for label + extra fields + confirm button
 */
const LabeledValueEditRow = ({
  children,
  placeholder,
  setEditingIndex,
}: {
  children?: React.ReactElement | React.ReactElement[];
  placeholder?: string;
  setEditingIndex: (index: number | null) => void;
}) => {
  const { field: labelField } = useInput({ source: "label" });
  const { field: valueField } = useInput({ source: "value" });
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when entering edit mode
  React.useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const confirmEdit = useEvent(() => {
    const label = (labelField.value || "").trim();
    if (label) {
      // Set the label (trimmed)
      labelField.onChange(label);
      // Auto-generate value from label if value is empty (new items)
      if (!valueField.value) {
        valueField.onChange(toSlug(label));
      }
    }
    setEditingIndex(null);
  });

  return (
    <>
      <Input
        ref={inputRef}
        name={labelField.name}
        value={labelField.value || ""}
        onChange={labelField.onChange}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirmEdit();
          } else if (e.key === "Escape") {
            setEditingIndex(null);
          }
        }}
        onBlur={(e) => {
          labelField.onBlur();
          confirmEdit();
        }}
        placeholder={placeholder}
        className="h-8 text-sm"
      />
      {children}
      <IconButtonWithTooltip
        label="Confirm"
        onClick={confirmEdit}
        className="h-8 w-8 shrink-0"
      >
        <Check className="h-4 w-4" />
      </IconButtonWithTooltip>
    </>
  );
};

/**
 * Add button that triggers item creation and enters edit mode
 */
const LabeledValueAddButton = ({ onAdd }: { onAdd: () => void }) => {
  const { add } = useSimpleFormIterator();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        add();
        onAdd();
      }}
      className="mt-1"
    >
      <PlusCircle className="h-4 w-4 mr-1" />
      Add
    </Button>
  );
};
