import { useFieldValue, useRecordContext, useTranslate } from "ra-core";
import type { FileFieldProps } from "@/components/admin";
import { cn } from "@/lib/utils";

/**
 * Displays a preview for a single note attachment in the edition form.
 *
 * This component is inspired by react-admin's `ImageField` and is intended for
 * use as the child of `<FileInput>` (which provides one attachment record at a time).
 * For note display outside forms, use `<NoteAttachments>`.
 */
export const AttachmentField = (props: FileFieldProps) => {
  const {
    className,
    empty,
    title,
    target,
    download,
    defaultValue,
    source,
    record: _recordProp,
    ...rest
  } = props;
  const record = useRecordContext();
  const sourceValue = useFieldValue({ defaultValue, source, record });
  const titleValue =
    useFieldValue({
      ...props,
      // @ts-expect-error We ignore here because title might be a custom label or undefined instead of a field name
      source: title,
    })?.toString() ?? title;
  const translate = useTranslate();

  if (sourceValue == null) {
    if (!empty) {
      return null;
    }

    return (
      <div className={cn("inline-block", className)} {...rest}>
        {typeof empty === "string" ? translate(empty, { _: empty }) : empty}
      </div>
    );
  }

  const type = record?.type ?? record?.rawFile?.type;
  const srcValue = sourceValue.toString();

  return (
    <div className={cn("inline-block", className)} {...rest}>
      {isImageMimeType(type) ? (
        <a
          href={srcValue}
          title={titleValue}
          target={target}
          download={download}
          // useful to prevent click bubbling in a DataTable with rowClick
          onClick={(e) => e.stopPropagation()}
        >
          <img
            alt={titleValue}
            title={titleValue}
            src={srcValue}
            className="w-[200px] h-[100px] object-cover cursor-pointer object-left border border-border"
          />
        </a>
      ) : (
        <a
          href={srcValue}
          title={titleValue}
          target={target}
          download={download}
          // useful to prevent click bubbling in a DataTable with rowClick
          onClick={(e) => e.stopPropagation()}
        >
          {titleValue}
        </a>
      )}
    </div>
  );
};

const isImageMimeType = (mimeType?: string): boolean => {
  if (!mimeType) {
    return false;
  }
  return mimeType.startsWith("image/");
};
