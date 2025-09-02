import * as React from "react";
import { createPortal } from "react-dom";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb as BaseBreadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Translate } from "ra-core";

export const Breadcrumb = ({ children, ref }: BreadcrumbProps) => {
  const breadcrumbPortal = document.getElementById("breadcrumb");
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  if (!breadcrumbPortal) return null;
  return createPortal(
    <>
      <Separator
        decorative
        orientation="vertical"
        className="data-[orientation=vertical]:h-4 mr-4"
      />
      <BaseBreadcrumb ref={ref}>
        <BreadcrumbList>
          {isMobile && React.Children.count(children) > 2 ? (
            <React.Fragment>
              <BreadcrumbItem>
                <Drawer open={open} onOpenChange={setOpen}>
                  <DrawerTrigger aria-label="Toggle Menu">
                    <BreadcrumbEllipsis className="h-4 w-4" />
                  </DrawerTrigger>
                  <DrawerContent>
                    <DrawerHeader className="text-left">
                      <DrawerTitle>
                        <Translate i18nKey="ra.navigation.breadcrumb_drawer_title">
                          Navigate to
                        </Translate>
                      </DrawerTitle>
                      <DrawerDescription>
                        <Translate i18nKey="ra.navigation.breadcrumb_drawer_instructions">
                          Select a page to navigate to.
                        </Translate>
                      </DrawerDescription>
                    </DrawerHeader>
                    <ol className="grid gap-1 px-4">
                      {React.Children.toArray(children)
                        .slice(0, -1)
                        .map((item) => item)}
                    </ol>
                    <DrawerFooter className="pt-4">
                      <DrawerClose asChild>
                        <Button variant="outline">
                          <Translate i18nKey="ra.action.close">Close</Translate>
                        </Button>
                      </DrawerClose>
                    </DrawerFooter>
                  </DrawerContent>
                </Drawer>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              {React.Children.toArray(children).slice(-1)}
            </React.Fragment>
          ) : (
            React.Children.map(children, (child, index) => (
              <React.Fragment key={index}>
                {child}
                {index < React.Children.count(children) - 1 ? (
                  <BreadcrumbSeparator />
                ) : null}
              </React.Fragment>
            ))
          )}
        </BreadcrumbList>
      </BaseBreadcrumb>
    </>,
    breadcrumbPortal
  );
};

export { BreadcrumbItem, BreadcrumbPage };

export type BreadcrumbProps = React.ComponentProps<"nav">;
