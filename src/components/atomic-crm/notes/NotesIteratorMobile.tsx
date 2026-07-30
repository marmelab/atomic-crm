import type { Identifier } from "ra-core";
import {
  useGetIdentity,
  useListContext,
  useTimeout,
  useTranslate,
} from "ra-core";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RotateCcw } from "lucide-react";

import { RelativeDate } from "../misc/RelativeDate";
import { Status } from "../misc/Status";
import { useGetSalesName } from "../sales/useGetSalesName";
import type { ContactNote } from "../types";
import { InfinitePagination } from "../misc/InfinitePagination";

export const NotesIteratorMobile = ({
  contactId,
  showStatus,
}: {
  contactId: Identifier;
  showStatus?: boolean;
}) => {
  const {
    data = [],
    error,
    isPending,
    refetch,
  } = useListContext<ContactNote>();
  const translate = useTranslate();
  const oneSecondHasPassed = useTimeout(1000);
  if (isPending) {
    if (!oneSecondHasPassed) {
      return null;
    }
    return (
      <div>
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="space-y-2 mt-1" key={index}>
            <div className="flex flex-row space-x-2 items-center">
              <Skeleton className="w-full h-4" />
            </div>
            <Skeleton className="w-full h-12" />
            <Separator />
          </div>
        ))}
      </div>
    );
  }
  if (error && !data?.length) {
    return (
      <div className="p-4">
        <div className="text-center text-muted-foreground mb-4">
          {translate("resources.notes.list.error_loading", {
            _: "Error loading notes",
          })}
        </div>
        <div className="text-center mt-2">
          <Button
            onClick={() => {
              refetch();
            }}
          >
            <RotateCcw />
            {translate("crm.common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y">
        {data.map((note) => (
          <NoteMobile
            key={note.id}
            note={note}
            contactId={contactId}
            showStatus={showStatus}
          />
        ))}
      </div>
      <InfinitePagination />
    </>
  );
};

export const NoteMobile = ({
  note,
  contactId,
  showStatus,
}: {
  note: ContactNote;
  contactId: Identifier;
  showStatus?: boolean;
}) => {
  const translate = useTranslate();
  const { identity } = useGetIdentity();
  const isCurrentUser = note.sales_id === identity?.id;
  const salesName = useGetSalesName(note.sales_id, {
    enabled: !isCurrentUser,
  });

  return (
    <Link
      to={`/contacts/${contactId}/notes/${note.id}`}
      className="block active:bg-accent/50 -mx-2 px-2 py-2 rounded-md"
    >
      <div className="flex items-center space-x-2 w-full">
        <div className="inline-flex h-full items-center text-sm text-muted-foreground">
          {isCurrentUser ? translate("resources.notes.me") : salesName}{" "}
          {showStatus && note.status && (
            <Status className="ml-2" status={note.status} />
          )}
        </div>
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground">
          <RelativeDate date={note.date} />
        </span>
      </div>
      {note.text && (
        <p className="pt-2 text-sm line-clamp-3">
          {note.text.replace(/\s+/g, " ").trim()}
        </p>
      )}
    </Link>
  );
};
