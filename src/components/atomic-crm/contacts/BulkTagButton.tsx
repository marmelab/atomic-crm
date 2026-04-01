import { Plus, Tag as TagIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  useGetMany,
  useListContext,
  useNotify,
  useRefresh,
  useTranslate,
  useUpdate,
} from "ra-core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { TagForm } from "../tags/TagForm";
import { useCreateTag } from "../tags/useCreateTag";
import { useTags } from "../tags/useTags";
import type { Contact, Tag } from "../types";

type BulkTagDialogMode = "select" | "create";

export function BulkTagButton() {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const [update] = useUpdate<Contact>("contacts", undefined, {
    returnPromise: true,
  });
  const createTag = useCreateTag();
  const { onUnselectItems, selectedIds = [] } = useListContext<Contact>();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<BulkTagDialogMode>("select");
  const [isApplying, setIsApplying] = useState(false);

  const { data: selectedContacts = [], isPending: isPendingContacts } =
    useGetMany<Contact>(
      "contacts",
      { ids: selectedIds },
      { enabled: open && selectedIds.length > 0 },
    );
  const { data: tags = [], isPending: isPendingTags } = useTags({
    enabled: open,
  });

  const closeDialog = useCallback(() => {
    setOpen(false);
    setMode("select");
  }, []);

  useEffect(() => {
    if (!selectedIds.length && open) {
      closeDialog();
    }
  }, [closeDialog, open, selectedIds.length]);

  const applyTagToSelection = useCallback(
    async (tag: Tag) => {
      const contactsToUpdate = selectedContacts.filter(
        (contact) => !contact.tags.includes(tag.id),
      );

      setIsApplying(true);

      try {
        await Promise.all(
          contactsToUpdate.map((contact) =>
            update("contacts", {
              id: contact.id,
              data: { tags: [...(contact.tags ?? []), tag.id] },
              previousData: contact,
            }),
          ),
        );

        notify(
          contactsToUpdate.length > 0
            ? "resources.contacts.bulk_tag.success"
            : "resources.contacts.bulk_tag.noop",
          {
            messageArgs: { smart_count: contactsToUpdate.length },
            type: "success",
          },
        );
        closeDialog();
        onUnselectItems();
        refresh();
      } catch (error) {
        notify("resources.contacts.bulk_tag.error", {
          type: "error",
        });
        console.error("Bulk tag failed:", error);
      } finally {
        setIsApplying(false);
      }
    },
    [closeDialog, update, notify, onUnselectItems, refresh, selectedContacts],
  );

  const handleCreateTag = async (data: Pick<Tag, "name" | "color">) => {
    const tag = await createTag(data);
    await applyTagToSelection(tag);
  };

  if (!selectedIds.length) {
    return null;
  }

  const isBusy = isApplying || isPendingContacts || isPendingTags;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        onClick={() => setOpen(true)}
      >
        <TagIcon />
        {translate("resources.contacts.bulk_tag.action")}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            closeDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {mode === "select" ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {translate("resources.contacts.bulk_tag.title")}
                </DialogTitle>
                <DialogDescription>
                  {translate("resources.contacts.bulk_tag.description")}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col space-y-2 items-start">
                {isPendingTags ? (
                  <p className="text-sm text-muted-foreground">
                    {translate("crm.common.loading")}
                  </p>
                ) : tags.length > 0 ? (
                  tags.map((tag) => (
                    <Button
                      key={tag.id}
                      type="button"
                      variant="ghost"
                      disabled={isBusy}
                      className="px-0 py-0 hover:bg-default dark:hover:bg-default mb-0"
                      onClick={() => applyTagToSelection(tag)}
                    >
                      <Badge
                        variant="secondary"
                        className="font-normal text-black cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </Badge>
                    </Button>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {translate("resources.contacts.bulk_tag.empty")}
                  </p>
                )}
              </div>

              <div className="flex justify-start">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => setMode("create")}
                >
                  <Plus />
                  {translate("resources.tags.action.create")}
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  {translate("resources.tags.dialog.create_title")}
                </DialogTitle>
                <DialogDescription>
                  {translate("resources.contacts.bulk_tag.create_description")}
                </DialogDescription>
              </DialogHeader>

              <TagForm
                cancelLabel={translate("resources.contacts.bulk_tag.back")}
                open={open && mode === "create"}
                onCancel={() => setMode("select")}
                onSubmit={handleCreateTag}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
