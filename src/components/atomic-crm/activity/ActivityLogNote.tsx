import { type ReactNode } from "react";
import { Link } from "react-router";

import { Markdown } from "../misc/Markdown";

type ActivityLogNoteProps = {
  header: ReactNode;
  text: string;
  link: string;
};

export function ActivityLogNote({ header, text, link }: ActivityLogNoteProps) {
  if (!text) {
    return null;
  }

  return (
    <div className="p-0">
      <div className="flex flex-col space-y-2 w-full">
        <div className="flex flex-row space-x-1 items-center w-full">
          {header}
        </div>
        <Link to={link} className="hover:bg-muted rounded transition-colors">
          <Markdown className="text-sm line-clamp-3 overflow-hidden [&_p]:my-1 [&_p:first-child]:mt-0 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:my-1 [&_blockquote]:text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a:hover]:no-underline">
            {text}
          </Markdown>
        </Link>
      </div>
    </div>
  );
}
