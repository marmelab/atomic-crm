import { Plus, Tag as TagIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  useDataProvider,
  useGetList,
  useGetMany,
  useListContext,
  useNotify,
  useRefresh,
  useTranslate,
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
import type { Contact, Tag } from "../types";

type BulkTagDialogMode = "select" | "create";

export function BulkTagButton() {
  const translate = useTranslate();
  const notify = useNotify();
  const refresh = useRefresh();
  const dataProvider = useDataProvider();
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
  const { data: tags = [], isPending: isPendingTags } = useGetList<Tag>(
    "tags",
    {
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "name", order: "ASC" },
    },
    { enabled: open },
  );

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
            dataProvider.update<Contact>("contacts", {
              id: contact.id,
              data: {
                tags: Array.from(new Set([...(contact.tags ?? []), tag.id])),
              },
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
    [
      closeDialog,
      dataProvider,
      notify,
      onUnselectItems,
      refresh,
      selectedContacts,
    ],
  );

  const handleCreateTag = async (data: Pick<Tag, "name" | "color">) => {
    const response = await dataProvider.create<Tag>("tags", { data });
    await applyTagToSelection(response.data);
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

              <div className="space-y-3 py-2">
                {isPendingTags ? (
                  <p className="text-sm text-muted-foreground">
                    {translate("crm.common.loading")}
                  </p>
                ) : tags.length > 0 ? (
                  tags.map((tag) => (
                    <Button
                      key={tag.id}
                      type="button"
                      variant="outline"
                      className="w-full justify-start h-auto py-3"
                      disabled={isBusy}
                      onClick={() => applyTagToSelection(tag)}
                    >
                      <Badge
                        variant="secondary"
                        className="font-normal text-black"
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

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="ghost"
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
