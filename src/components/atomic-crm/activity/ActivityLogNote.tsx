import { type ReactNode } from "react";
import { Link } from "react-router";

type ActivityLogNoteProps = {
  header: ReactNode;
  text: string;
  link: string | false;
  icon?: ReactNode;
};

export function ActivityLogNote({
  header,
  text,
  link,
  icon,
}: ActivityLogNoteProps) {
  if (!text) {
    return null;
  }

  const plainText = text.replace(/\s+/g, " ").trim();

  const textElement = (
    <p className="text-sm line-clamp-3 overflow-hidden">
      {icon && <span className="float-left mr-2 mt-0.5">{icon}</span>}
      {plainText}
    </p>
  );

  return (
    <div className="p-0">
      <div className="flex flex-col space-y-2 w-full">
        <div className="flex flex-row space-x-1 items-center w-full">
          {header}
        </div>
        <div className="md:max-w-150 [&_p]:my-auto">
          {link !== false ? (
            <Link
              to={link}
              className="hover:bg-muted rounded transition-colors"
            >
              {textElement}
            </Link>
          ) : (
            textElement
          )}
        </div>
      </div>
    </div>
  );
}
