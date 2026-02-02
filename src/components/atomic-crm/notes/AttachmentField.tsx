import { useFieldValue, useRecordContext, useTranslate } from "ra-core";
import get from "lodash/get";
import type { FileFieldProps } from "@/components/admin";
import { cn } from "@/lib/utils";
import { isImageMimeType } from "./isImageMimeType";

export const AttachmentField = (props: FileFieldProps) => {
  const {
    className,
    empty,
    title,
    src,
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
              {isImageMimeType(file.type) ? (
                <img
                  alt={fileTitleValue}
                  title={fileTitleValue}
                  src={srcValue}
                />
              ) : (
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
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className={cn("inline-block", className)} {...rest}>
      {isImageMimeType(record?.rawFile.type) ? (
        <img alt={titleValue} title={titleValue} src={sourceValue?.toString()} />
      ) : (
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
      )}
    </div>
  );
};
