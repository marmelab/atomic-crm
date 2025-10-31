import { Paperclip } from "lucide-react";

import type { AttachmentNote, ContactNote, DealNote } from "../types";

export const NoteAttachments = ({ note }: { note: ContactNote | DealNote }) => {
  if (!note.attachments || note.attachments.length === 0) {
    return null;
  }

  const imageAttachments = note.attachments.filter(
    (attachment: AttachmentNote) => isImageMimeType(attachment.type),
  );
  const otherAttachments = note.attachments.filter(
    (attachment: AttachmentNote) => !isImageMimeType(attachment.type),
  );

  return (
    <div className="flex flex-col">
      {imageAttachments.length > 0 && (
        <div className="grid grid-cols-4 gap-8">
          {imageAttachments.map((attachment: AttachmentNote, index: number) => (
            <div key={index}>
              <img
                src={attachment.src}
                alt={attachment.title}
                className="w-[200px] h-[100px] object-cover cursor-pointer object-left border border-border"
                onClick={() => window.open(attachment.src, "_blank")}
              />
            </div>
          ))}
        </div>
      )}
      {otherAttachments.length > 0 &&
        otherAttachments.map((attachment: AttachmentNote, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <Paperclip className="w-4 h-4" />
            <a
              href={attachment.src}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              {attachment.title}
            </a>
          </div>
        ))}
    </div>
  );
};

const isImageMimeType = (mimeType?: string): boolean => {
  if (!mimeType) {
    return false;
  }
  return mimeType.startsWith("image/");
};
