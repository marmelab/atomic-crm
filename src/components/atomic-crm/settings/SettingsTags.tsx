import { Pencil } from "lucide-react";
import { RecordContextProvider, useTranslate } from "ra-core";
import { useState } from "react";
import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { TagEditModal } from "../tags/TagEditModal";
import { useTags } from "../tags/useTags";
import type { Tag } from "../types";

export const SettingsTags = () => {
  const translate = useTranslate();
  const { data: tags } = useTags();
  const [editedTag, setEditedTag] = useState<Tag>();

  return (
    <Card id="tags">
      <CardContent className="space-y-4">
        <h2 className="text-xl font-semibold text-muted-foreground">
          {translate("resources.tags.name", { smart_count: 2 })}
        </h2>
        {tags?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {translate("resources.tags.empty")}
          </p>
        )}
        {tags?.map((tag) => (
          <div key={tag.id} className="flex items-center gap-2">
            <span
              className="text-black px-2 py-1 text-sm rounded-md"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditedTag(tag)}
              >
                <Pencil />
                {translate("ra.action.edit")}
              </Button>
              <RecordContextProvider value={tag}>
                <DeleteButton resource="tags" redirect={false} size="sm" />
              </RecordContextProvider>
            </div>
          </div>
        ))}
        {editedTag && (
          <TagEditModal
            tag={editedTag}
            open
            onClose={() => setEditedTag(undefined)}
          />
        )}
      </CardContent>
    </Card>
  );
};
