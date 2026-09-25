import { useTranslate } from "ra-core";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export const LostReasonDialog = ({
  open,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) => {
  const translate = useTranslate();
  const [reason, setReason] = useState("");
  const trimmedReason = reason.trim();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmedReason) return;
    onConfirm(trimmedReason);
    setReason("");
  };

  const handleCancel = () => {
    setReason("");
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {translate("resources.deals.lost_reason_dialog.title")}
            </DialogTitle>
            <DialogDescription>
              {translate("resources.deals.lost_reason_dialog.description")}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label={translate("resources.deals.fields.lost_reason")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            required
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              {translate("ra.action.cancel")}
            </Button>
            <Button type="submit" disabled={!trimmedReason}>
              {translate("resources.deals.lost_reason_dialog.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
