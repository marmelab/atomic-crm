import { Check, type LucideIcon, X } from "lucide-react";
import { RaRecord, useFieldValue, useTranslate } from "ra-core";

import type { FieldProps } from "@/lib/field.type";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Displays a boolean value as a colored check or close icon.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/booleanfield/ BooleanField documentation}
 *
 * @example
 * import { Show, SimpleShowLayout, BooleanField } from '@/components/admin';
 *
 * const PostShow = () => (
 *   <Show>
 *     <SimpleShowLayout>
 *       <BooleanField source="is_published" />
 *       <BooleanField source="allow_comments" />
 *     </SimpleShowLayout>
 *   </Show>
 * );
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const BooleanField = <RecordType extends RaRecord = any>({
  source,
  record,
  defaultValue,
  className,
  TrueIcon = Check,
  FalseIcon = X,
  valueLabelFalse,
  valueLabelTrue,
  looseValue = false,
  empty = null,
}: BooleanFieldProps<RecordType>) => {
  const value = useFieldValue({ source, record, defaultValue });
  const isTruthyValue = value === true || (looseValue && value);
  const baseClassName = "size-5 text-foreground";

  if (looseValue || typeof value === "boolean") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {isTruthyValue ? (
              TrueIcon ? (
                <TrueIcon className={cn(baseClassName, className)} />
              ) : (
                <div />
              )
            ) : FalseIcon ? (
              <FalseIcon className={cn(baseClassName, className)} />
            ) : (
              <div />
            )}
          </TooltipTrigger>
          <TooltipContent>
            <RenderLabel
              value={!!value}
              valueLabelFalse={valueLabelFalse}
              valueLabelTrue={valueLabelTrue}
            />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <>{empty}</>;
};

function RenderLabel({
  value,
  valueLabelTrue,
  valueLabelFalse,
}: Pick<BooleanFieldProps, "valueLabelFalse" | "valueLabelTrue"> & {
  value: boolean;
}) {
  const translate = useTranslate();

  let label = value ? valueLabelTrue : valueLabelFalse;
  if (!label) {
    label = value ? "ra.boolean.true" : "ra.boolean.false";
  }
  if (typeof label === "string") {
    label = translate(label, { _: label });
  }

  return <p>{label}</p>;
}

export interface BooleanFieldProps<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RecordType extends RaRecord = any,
> extends FieldProps<RecordType> {
  className?: string;
  defaultValue?: unknown;
  TrueIcon?: LucideIcon | null;
  FalseIcon?: LucideIcon | null;
  valueLabelTrue?: string;
  valueLabelFalse?: string;
  looseValue?: boolean;
}
