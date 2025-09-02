import { AlertCircle, CheckCircle } from "lucide-react";
import { useTranslate } from "ra-core";
import * as React from "react";
import { type ComponentType, type MouseEventHandler, useCallback } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Confirm = (props: ConfirmProps) => {
  const {
    className,
    isOpen = false,
    loading,
    title,
    content,
    cancel = "ra.action.cancel",
    confirm = "ra.action.confirm",
    confirmColor = "primary",
    ConfirmIcon = CheckCircle,
    CancelIcon = AlertCircle,
    onClose,
    onConfirm,
    translateOptions = {},
    titleTranslateOptions = translateOptions,
    contentTranslateOptions = translateOptions,
    ...rest
  } = props;

  const translate = useTranslate();

  const handleConfirm = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onConfirm(e);
    },
    [onConfirm],
  );

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className={className} onClick={handleClick} {...rest}>
        <DialogHeader>
          <DialogTitle>
            {typeof title === "string"
              ? translate(title, { _: title, ...titleTranslateOptions })
              : title}
          </DialogTitle>
          {typeof content === "string" ? (
            <DialogDescription>
              {translate(content, {
                _: content,
                ...contentTranslateOptions,
              })}
            </DialogDescription>
          ) : (
            content
          )}
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={loading}
            onClick={onClose}
            className="gap-1"
          >
            <CancelIcon className="h-5 w-5" />
            {translate(cancel, { _: cancel })}
          </Button>
          <Button
            disabled={loading}
            onClick={handleConfirm}
            className="gap-1"
            variant={confirmColor === "warning" ? "destructive" : "default"}
          >
            <ConfirmIcon className="h-5 w-5" />
            {translate(confirm, { _: confirm })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export interface ConfirmProps {
  cancel?: string;
  className?: string;
  confirm?: string;
  confirmColor?: "primary" | "warning";
  ConfirmIcon?: ComponentType;
  CancelIcon?: ComponentType;
  content: React.ReactNode;
  isOpen?: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: MouseEventHandler;
  title: React.ReactNode;
  /**
   * @deprecated use `titleTranslateOptions` and `contentTranslateOptions` instead
   */
  translateOptions?: object;
  titleTranslateOptions?: object;
  contentTranslateOptions?: object;
}
