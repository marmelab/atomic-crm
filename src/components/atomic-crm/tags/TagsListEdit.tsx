import { Edit, Plus } from "lucide-react";
import {
  useGetList,
  useGetMany,
  useRecordContext,
  useUpdate,
  type Identifier,
  type RaRecord,
} from "ra-core";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { TagChip } from "./TagChip";
import { TagCreateModal } from "./TagCreateModal";
import type { Tag } from "../types";

type TaggableRecord = RaRecord & { tags: Identifier[] };

/**
 * Generic tags editor for any resource that has a `tags bigint[]` column.
 * Pass the resource name (e.g. "clients", "suppliers").
 */
export const TagsListEdit = ({ resource }: { resource: string }) => {
  const record = useRecordContext<TaggableRecord>();
  const [open, setOpen] = useState(false);

  const { data: allTags, isPending: isPendingAllTags } = useGetList<Tag>(
    "tags",
    {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "name", order: "ASC" },
    },
  );
  const { data: tags, isPending: isPendingRecordTags } = useGetMany<Tag>(
    "tags",
    { ids: record?.tags },
    { enabled: record && record.tags && record.tags.length > 0 },
  );
  const [update] = useUpdate();

  const unselectedTags =
    allTags &&
    record &&
    allTags.filter((tag) => !record.tags?.includes(tag.id));

  const handleTagAdd = (id: Identifier) => {
    if (!record) return;
    const nextTags = [...(record.tags ?? []), id];
    update(resource, {
      id: record.id,
      data: { tags: nextTags },
      previousData: record,
    });
  };

  const handleTagDelete = async (id: Identifier) => {
    if (!record) return;
    const nextTags = record.tags.filter((tagId) => tagId !== id);
    await update(resource, {
      id: record.id,
      data: { tags: nextTags },
      previousData: record,
    });
  };

  const handleTagCreated = useCallback(
    async (tag: Tag) => {
      if (!record) return;
      await update(
        resource,
        {
          id: record.id,
          data: { tags: [...(record.tags ?? []), tag.id] },
          previousData: record,
        },
        { onSuccess: () => setOpen(false) },
      );
    },
    [update, record, resource],
  );

  if (isPendingRecordTags || isPendingAllTags) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {tags?.map((tag) => (
        <div key={tag.id}>
          <TagChip tag={tag} onUnlink={() => handleTagDelete(tag.id)} />
        </div>
      ))}

      <div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 md:h-6 cursor-pointer"
            >
              <Plus className="w-4 h-4 md:w-3 md:h-3 mr-1" />
              Aggiungi tag
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {unselectedTags?.map((tag) => (
              <DropdownMenuItem
                key={tag.id}
                onClick={() => handleTagAdd(tag.id)}
              >
                <Badge
                  variant="secondary"
                  className="text-sm md:text-xs font-normal text-black"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                </Badge>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={() => setOpen(true)}>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start p-0 cursor-pointer text-base md:text-sm"
              >
                <Edit className="w-4 h-4 md:w-3 md:h-3 mr-2" />
                Crea nuovo tag
              </Button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <TagCreateModal
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={handleTagCreated}
      />
    </div>
  );
};
