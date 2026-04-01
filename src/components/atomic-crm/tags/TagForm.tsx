import { SaveIcon } from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslate } from "ra-core";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type { Tag } from "../types";
import { colors } from "./colors";
import { RoundButton } from "./RoundButton";

type TagFormProps = {
  open: boolean;
  cancelLabel?: string;
  tag?: Pick<Tag, "name" | "color">;
  onCancel?(): void;
  onSubmit(tag: Pick<Tag, "name" | "color">): Promise<void>;
};

export function TagForm({
  open,
  cancelLabel,
  tag,
  onCancel,
  onSubmit,
}: TagFormProps) {
  const translate = useTranslate();
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(colors[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNewTagNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setNewTagName(event.target.value);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({ name: newTagName.trim(), color: newTagColor });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    setNewTagName(tag?.name ?? "");
    setNewTagColor(tag?.color ?? colors[0]);
    setIsSubmitting(false);
  }, [open, tag]);

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="tag-name">
            {translate("resources.tags.dialog.name_label")}
          </Label>
          <Input
            id="tag-name"
            autoFocus
            value={newTagName}
            onChange={handleNewTagNameChange}
            placeholder={translate("resources.tags.dialog.name_placeholder")}
          />
        </div>

        <div className="space-y-2">
          <Label>{translate("resources.tags.dialog.color")}</Label>
          <div className="flex flex-wrap">
            {colors.map((color) => (
              <RoundButton
                key={color}
                color={color}
                selected={color === newTagColor}
                handleClick={() => {
                  setNewTagColor(color);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {cancelLabel ?? translate("ra.action.cancel")}
          </Button>
        )}
        <Button
          type="submit"
          variant="outline"
          disabled={isSubmitting || !newTagName.trim()}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "text-primary",
            isSubmitting ? "cursor-not-allowed" : "cursor-pointer",
          )}
        >
          <SaveIcon />
          {translate("ra.action.save")}
        </Button>
      </div>
    </form>
  );
}
