import { XIcon } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerVirtualKeyboardProvider,
} from "@/components/ui/drawer";

export interface FormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

/**
 * A full-screen bottom drawer for mobile forms. Unlike a Sheet, it keeps its
 * content above the iOS software keyboard and stops drags from panning the
 * page behind it.
 *
 * It focuses the field marked with `data-autofocus` on open, with the caret at
 * the end of its text. The field must not focus itself (e.g. with `autoFocus`):
 * focused while the drawer still slides in from below the screen, iOS scrolls
 * it out of view.
 */
export const FormDrawer = ({
  open,
  onOpenChange,
  children,
}: FormDrawerProps) => {
  const popupRef = useRef<HTMLDivElement>(null);

  const focusField = () => {
    const field =
      popupRef.current?.querySelector<HTMLElement>("[data-autofocus]");
    field?.focus({ preventScroll: true });
    if (field instanceof HTMLTextAreaElement) {
      // move cursor to end of text
      field.setSelectionRange(field.value.length, field.value.length);
    }
    return false;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerVirtualKeyboardProvider>
        <DrawerContent
          ref={popupRef}
          initialFocus={focusField}
          className="h-dvh max-h-none data-[swipe-direction=down]:rounded-t-none pb-(--drawer-keyboard-inset)"
          aria-describedby={undefined}
        >
          {children}
          <DrawerClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-4 right-4"
              />
            }
          >
            <XIcon className="size-6 md:size-4" />
            <span className="sr-only">Close</span>
          </DrawerClose>
        </DrawerContent>
      </DrawerVirtualKeyboardProvider>
    </Drawer>
  );
};
