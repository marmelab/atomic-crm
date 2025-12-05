import type { ReactNode, ElementType, HTMLAttributes } from "react";
import { createElement } from "react";
import type { ExtractRecordPaths, HintedString } from "ra-core";
import {
  FieldTitle,
  useRecordContext,
  useResourceContext,
  useTranslate,
} from "ra-core";
import { cn } from "@/lib/utils";

import { TextField } from "@/components/admin/text-field";

/**
 * Displays a labeled field-value pair with flexible rendering options.
 *
 * Supports either vertical or inline layout.
 * It can render children, use a custom field component, or display a TextField by default.
 * To be used with RecordContext, e.g. inside Show, or inside ArrayField to display array items.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/recordfield/ RecordField documentation}
 *
 * @example
 * import { NumberField, RecordField, Show } from '@/components/admin';
 *
 * const PostShow = () => (
 *   <Show>
 *     <div className="flex flex-col gap-4">
 *       <RecordField source="reference" label="Ref." />
 *       <RecordField
 *         label="dimensions"
 *         render={record => `${record.width}x${record.height}`}
 *       />
 *       <RecordField source="price">
 *         <NumberField source="price" options={
 *           style: 'currency',
 *           currency: 'USD',
 *         }/>
 *       <RecordField source="status" variant="inline" />
 *     </div>
 *   </Show>
 * );
 */
export const RecordField = <
  RecordType extends Record<string, any> = Record<string, any>,
>(
  props: RecordFieldProps<RecordType>,
) => {
  const {
    children,
    className,
    empty,
    field,
    label,
    render,
    resource: _,
    source,
    record: recordProp,
    variant,
    ...rest
  } = props;
  const resource = useResourceContext(props);
  const record = useRecordContext<RecordType>({ recordProp });
  const translate = useTranslate();

  if (!source && !label && !render) return null;

  return (
    <div
      className={cn(
        className,
        "flex",
        variant === "inline" ? "flex-row" : "flex-col",
      )}
      {...rest}
    >
      {label !== "" && label !== false ? (
        <div
          className={cn(
            variant === "inline" ? "block min-w-50" : "text-xs",
            "text-muted-foreground",
          )}
        >
          <FieldTitle
            label={label}
            source={source}
            resource={resource}
            isRequired={false}
          />
        </div>
      ) : null}
      {children ? (
        <span className="flex-1">{children}</span>
      ) : render ? (
        record && (
          <span className="flex-1">
            {render(record) ||
              (typeof empty === "string"
                ? translate(empty, { _: empty })
                : empty)}
          </span>
        )
      ) : field ? (
        createElement(field, {
          source,
          empty,
          className: "flex-1",
        })
      ) : source ? (
        <TextField source={source} empty={empty} className="flex-1" />
      ) : null}
    </div>
  );
};

// FIXME remove custom type when using TypeScript >= 5.4 as it is now native
type NoInfer<T> = T extends infer U ? U : never;

export interface RecordFieldProps<
  RecordType extends Record<string, any> = Record<string, any>,
> extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  className?: string;
  empty?: ReactNode;
  field?: ElementType;
  label?: ReactNode;
  render?: (record: RecordType) => React.ReactNode;
  resource?: string;
  source?: NoInfer<HintedString<ExtractRecordPaths<RecordType>>>;
  record?: RecordType;
  variant?: "default" | "inline";
}
