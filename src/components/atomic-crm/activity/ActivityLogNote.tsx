import { Fragment, type ReactNode } from "react";

type ActivityLogContactNoteCreatedProps = {
  header: ReactNode;
  text: string;
};

export function ActivityLogNote({
  header,
  text,
}: ActivityLogContactNoteCreatedProps) {
  if (!text) {
    return null;
  }
  const paragraphs = text.split("\n");

  return (
    <div className="p-0">
      <div className="flex flex-col space-y-2 w-full">
        <div className="flex flex-row space-x-1 items-center w-full">
          {header}
        </div>
        <div>
          <div className="text-sm line-clamp-3 overflow-hidden">
            {paragraphs.map((paragraph: string, index: number) => (
              <Fragment key={index}>
                {paragraph}
                {index < paragraphs.length - 1 && <br />}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
