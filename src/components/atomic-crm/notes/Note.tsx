import { CircleX, Edit, Save, Trash2 } from "lucide-react";
import {
  Form,
  useDelete,
  useNotify,
  useResourceContext,
  useUpdate,
  WithRecord,
} from "ra-core";
import { useEffect, useRef, useState } from "react";
import type { FieldValues, SubmitHandler } from "react-hook-form";
import { ReferenceField } from "@/components/admin/reference-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { Markdown } from "../misc/Markdown";
import { RelativeDate } from "../misc/RelativeDate";
import { Status } from "../misc/Status";
import { SaleName } from "../sales/SaleName";
import type { ContactNote, DealNote } from "../types";
import { NoteAttachments } from "./NoteAttachments";
import { NoteEditSheet } from "./NoteEditSheet";
import { NoteInputs } from "./NoteInputs";
import { useIsMobile } from "@/hooks/use-mobile";

export const Note = ({
  showStatus,
  note,
}: {
  showStatus?: boolean;
  note: DealNote | ContactNote;
  isLast: boolean;
}) => {
  const isMobile = useIsMobile();
  const [isHover, setHover] = useState(false);
  const [isEditing, setEditing] = useState(false);
  const [isExpanded, setExpanded] = useState(false);
  const [isTruncated, setTruncated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const resource = useResourceContext();
  const notify = useNotify();

  // Detect if content is truncated
  useEffect(() => {
    const el = contentRef.current;
    if (el) {
      setTruncated(el.scrollHeight > el.clientHeight);
    }
  }, [note.text]);

  const [update, { isPending }] = useUpdate();

  const [deleteNote] = useDelete(resource, undefined, {
    mutationMode: "undoable",
    onSuccess: () => {
      notify("Note deleted", { type: "info", undoable: true });
    },
  });

  const handleDelete = () => {
    deleteNote(resource, { id: note.id, previousData: note });
  };

  const handleEnterEditMode = () => {
    setEditing(!isEditing);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setHover(false);
  };

  const handleNoteUpdate: SubmitHandler<FieldValues> = (values) => {
    update(
      resource,
      { id: note.id, data: values, previousData: note },
      {
        onSuccess: () => {
          setEditing(false);
          setHover(false);
        },
      },
    );
  };

  const content = (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="mb-4"
    >
      <div className="flex items-center space-x-2 md:space-x-4 w-full">
        <ReferenceField source="company_id" reference="companies" link="show">
          <CompanyAvatar width={20} height={20} />
        </ReferenceField>
        <div className="inline-flex h-full items-center text-sm text-muted-foreground">
          {isMobile ? "By " : null}
          <ReferenceField
            record={note}
            resource={resource}
            source="sales_id"
            reference="sales"
            link={false}
          >
            <WithRecord render={(record) => <SaleName sale={record} />} />
          </ReferenceField>{" "}
          {isMobile ? null : "added a note "}
          {showStatus && note.status && (
            <Status className="ml-2" status={note.status} />
          )}
        </div>
        {isMobile ? null : (
          <span className={`${isHover ? "visible" : "invisible"}`}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleEnterEditMode}
                    className="p-1 h-auto cursor-pointer"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit note</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    className="p-1 h-auto cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete note</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </span>
        )}
        <div className="flex-1"></div>
        <span className="text-sm text-muted-foreground">
          <RelativeDate date={note.date} />
        </span>
      </div>
      {!isMobile && isEditing ? (
        <Form onSubmit={handleNoteUpdate} record={note} className="mt-1">
          <NoteInputs showStatus={showStatus} />
          <div className="flex justify-end mt-2 space-x-4">
            <Button
              variant="ghost"
              onClick={handleCancelEdit}
              type="button"
              className="cursor-pointer"
            >
              <CircleX className="w-4 h-4" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Update note
            </Button>
          </div>
        </Form>
      ) : (
        <div className="pt-2 text-sm md:max-w-150">
          {note.text && (
            <div
              ref={contentRef}
              className={cn(
                "overflow-hidden transition-[max-height] duration-300 ease-in-out",
                isExpanded ? "max-h-[5000px]" : "max-h-46",
              )}
            >
              <Markdown className="[&_p]:leading-5 [&_p]:my-4 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a:hover]:no-underline">
                {note.text}
              </Markdown>
            </div>
          )}
          {isTruncated && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!isExpanded);
              }}
              className="text-primary text-sm mt-1 underline hover:no-underline cursor-pointer"
            >
              {isExpanded ? "Show less" : "Read more"}
            </button>
          )}

          {note.attachments && <NoteAttachments note={note} />}
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <NoteEditSheet
          open={isEditing}
          onOpenChange={setEditing}
          noteId={note.id}
        />
        <div onClick={() => setEditing(true)} className="cursor-pointer">
          {content}
        </div>
      </>
    );
  }

  return content;
};
