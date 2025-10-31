import { SaveIcon } from "lucide-react";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type { Tag } from "../types";
import { colors } from "./colors";
import { RoundButton } from "./RoundButton";

type TagDialogProps = {
  open: boolean;
  tag?: Pick<Tag, "name" | "color">;
  title: string;
  onSubmit(tag: Pick<Tag, "name" | "color">): Promise<void>;
  onClose(): void;
};

export function TagDialog({
  open,
  tag,
  title,
  onClose,
  onSubmit,
}: TagDialogProps) {
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(colors[0]);
  const [disabled, setDisabled] = useState(false);

  const handleNewTagNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setNewTagName(event.target.value);
  };

  const handleClose = () => {
    setDisabled(false);
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSubmit({ name: newTagName, color: newTagColor });

    setDisabled(true);
    setNewTagName("");
    setNewTagColor(colors[0]);

    handleClose();
  };

  useEffect(() => {
    setNewTagName(tag?.name ?? "");
    setNewTagColor(tag?.color ?? colors[0]);
  }, [tag]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag-name">Tag name</Label>
              <Input
                id="tag-name"
                autoFocus
                value={newTagName}
                onChange={handleNewTagNameChange}
                placeholder="Enter tag name"
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
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

          <div className="flex justify-end pt-4">
            <Button
              variant="outline"
              disabled={disabled}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "text-primary",
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
              )}
            >
              <SaveIcon />
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
