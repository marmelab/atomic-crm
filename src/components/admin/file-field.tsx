import type { HTMLAttributes } from "react";
import get from "lodash/get";
import type { ExtractRecordPaths, HintedString } from "ra-core";
import { useFieldValue, useTranslate } from "ra-core";
import { cn } from "@/lib/utils";
import type { FieldProps } from "@/lib/field.type";

/**
 * Displays a downloadable file link with customizable title and target.
 *
 * This field renders file URLs as clickable links that can open in new tabs or trigger downloads.
 * It supports arrays of files and prevents click bubbling in DataTable rows.
 * To be used with RecordField or DataTable.Col components, or anywhere a RecordContext is available.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/filefield/ FileField documentation}
 *
 * @example
 * import { FileField } from '@/components/admin/file-field';
 *
 * <FileField source="url" title="title" />
 *
 * // renders the record { id: 123, url: 'doc.pdf', title: 'Presentation' } as
 * <div>
 *     <a href="doc.pdf" title="Presentation">Presentation</a>
 * </div>
 */
export const FileField = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RecordType extends Record<string, any> = Record<string, any>,
>(
  props: FileFieldProps<RecordType>,
) => {
  const {
    className,
    empty,
    title,
    src,
    target,
    download,
    defaultValue,
    source,
    record,
    ...rest
  } = props;
  const sourceValue = useFieldValue({ defaultValue, source, record });
  const titleValue =
    useFieldValue({
      ...props,
      // @ts-expect-error We ignore here because title might be a custom label or undefined instead of a field name
      source: title,
    })?.toString() ?? title;
  const translate = useTranslate();

  if (
    sourceValue == null ||
    (Array.isArray(sourceValue) && sourceValue.length === 0)
  ) {
    if (!empty) {
      return null;
    }

    return (
      <div className={cn("inline-block", className)} {...rest}>
        {typeof empty === "string" ? translate(empty, { _: empty }) : empty}
      </div>
    );
  }

  if (Array.isArray(sourceValue)) {
    return (
      <ul className={cn("inline-block", className)} {...rest}>
        {sourceValue.map((file, index) => {
          const fileTitleValue = title ? get(file, title, title) : title;
          const srcValue = src ? get(file, src, title) : title;

          return (
            <li key={index}>
              <a
                href={srcValue}
                title={fileTitleValue}
                target={target}
                download={download}
                // useful to prevent click bubbling in a DataTable with rowClick
                onClick={(e) => e.stopPropagation()}
              >
                {fileTitleValue}
              </a>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className={cn("inline-block", className)} {...rest}>
      <a
        href={sourceValue?.toString()}
        title={titleValue}
        target={target}
        download={download}
        // useful to prevent click bubbling in a DataTable with rowClick
        onClick={(e) => e.stopPropagation()}
      >
        {titleValue}
      </a>
    </div>
  );
};

export interface FileFieldProps<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RecordType extends Record<string, any> = Record<string, any>,
>
  extends FieldProps<RecordType>, HTMLAttributes<HTMLElement> {
  /**
   * The source of the link to the file, for an array of files.
   */
  src?: string;
  title?: HintedString<ExtractRecordPaths<RecordType>>;
  target?: HTMLAnchorElement["target"];
  download?: HTMLAnchorElement["download"];
}
