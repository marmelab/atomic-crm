import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  useDataProvider,
  useNotify,
  useRefresh,
  useTranslate,
  type Identifier,
} from "ra-core";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  cohortDeleteSafety,
  describeLinks,
  offerDeleteSafety,
  type DeleteSafety,
} from "./programDeleteSafety";

// Edit, Archive, Delete — on the card itself, where the thing being acted
// on is.
//
// Nothing here knows which programme it is looking at. It takes the
// resource ("cohorts" or "offers") and the archive patch that resource
// uses, because a 1:1 Program is retired by clearing is_active while a
// group round is retired by completing it. Branching on the TYPE rather
// than on a name is the point: a second group program inherits all of this
// on the day it is created.
export const ProgramCardMenu = ({
  resource,
  id,
  name,
  editPath,
  archive,
  archived,
}: {
  resource: "cohorts" | "offers";
  id: Identifier;
  name: string;
  // The real edit form for this resource. Editing routes to it rather
  // than growing a second form that could drift from the first.
  editPath: string;
  archive: Record<string, unknown>;
  archived: boolean;
}) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const navigate = useNavigate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [checking, setChecking] = useState(false);
  const [safety, setSafety] = useState<DeleteSafety | null>(null);

  const askToDelete = async () => {
    setChecking(true);
    // Asked at the moment Leif asks, never cached: a round that was empty
    // this morning may have somebody on it now.
    const result =
      resource === "cohorts"
        ? await cohortDeleteSafety(dataProvider, id)
        : await offerDeleteSafety(dataProvider, id);
    setChecking(false);
    setSafety(result);
  };

  const doArchive = async () => {
    await dataProvider.update(resource, {
      id,
      data: archive,
      previousData: { id },
    });
    notify(
      translate("crm.programs.archived", {
        _: "%{name} archived. Nothing was deleted.",
        name,
      }),
      { type: "info" },
    );
    refresh();
  };

  const doDelete = async () => {
    try {
      await dataProvider.delete(resource, { id, previousData: { id } });
      notify(
        translate("crm.programs.deleted", { _: "%{name} deleted.", name }),
        { type: "info" },
      );
      refresh();
    } catch {
      // The database is the last word. If it refuses — a foreign key this
      // check did not know about — say so rather than pretending.
      notify(
        translate("crm.programs.delete_refused_by_database", {
          _: "%{name} could not be deleted: something still references it.",
          name,
        }),
        { type: "error" },
      );
    } finally {
      setSafety(null);
    }
  };

  const refused = safety != null && !safety.deletable;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            aria-label={translate("crm.programs.card_menu", {
              _: "Program actions",
            })}
            onClick={(event) => {
              // The whole card is a link to the programme; opening its
              // menu must not navigate away from it.
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => navigate(editPath)}>
            {translate("crm.programs.edit_program", { _: "Edit program" })}
          </DropdownMenuItem>
          {!archived && (
            <DropdownMenuItem onSelect={() => void doArchive()}>
              {translate("crm.programs.archive_program", {
                _: "Archive program",
              })}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            disabled={checking}
            onSelect={(event) => {
              event.preventDefault();
              void askToDelete();
            }}
          >
            {translate("crm.programs.delete_program", { _: "Delete program" })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={safety != null}
        onOpenChange={(open) => !open && setSafety(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {refused
                ? translate("crm.programs.delete_refused_title", {
                    _: "%{name} has history",
                    name,
                  })
                : translate("crm.programs.delete_confirm_title", {
                    _: "Delete %{name}?",
                    name,
                  })}
            </DialogTitle>
            <DialogDescription>
              {refused
                ? // Named, not merely refused. Deleting would take real
                  // people's records with it — the waiting list would go
                  // without even a foreign key to stop it.
                  translate("crm.programs.delete_refused_body", {
                    _: "It is linked to %{links}. Deleting it would take that with it, so archive it instead — everything stays, it just leaves your active programs.",
                    links: describeLinks(
                      safety && !safety.deletable ? safety.links : [],
                    ),
                  })
                : translate("crm.programs.delete_confirm_body", {
                    _: "Nothing is linked to it, so this removes it entirely. This cannot be undone.",
                  })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSafety(null)}
            >
              {translate("ra.action.cancel", { _: "Cancel" })}
            </Button>
            {refused
              ? !archived && (
                  <Button
                    type="button"
                    onClick={() => {
                      setSafety(null);
                      void doArchive();
                    }}
                  >
                    {translate("crm.programs.archive_program", {
                      _: "Archive program",
                    })}
                  </Button>
                )
              : safety != null && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void doDelete()}
                  >
                    {translate("crm.programs.delete_program", {
                      _: "Delete program",
                    })}
                  </Button>
                )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
