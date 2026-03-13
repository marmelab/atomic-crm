import { SaveButton } from "@/components/admin/form";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CreateBase,
  Form,
  useNotify,
  useRedirect,
  useResourceContext,
  useTranslate,
  type CreateBaseProps,
  type FormProps,
} from "ra-core";
import { type ReactNode } from "react";

export interface CreateSheetProps extends CreateBaseProps {
  /**
   * The children elements that will be rendered inside the sheet as form inputs
   */
  children: ReactNode;

  /**
   * Controls whether the sheet is open
   */
  open: boolean;

  /**
   * Callback fired when the sheet open state changes
   */
  onOpenChange: (open: boolean) => void;

  /**
   * The title displayed in the sheet header
   */
  title?: ReactNode;

  /**
   * Default values for the form
   */
  defaultValues?: FormProps["defaultValues"];
}

/**
 * A Sheet component that contains a create form with externally controlled open state.
 *
 * Renders a Sheet containing a CreateBase form. The sheet has a fixed footer with Save and Close buttons.
 * The open state is controlled externally via the open and onOpenChange props. The sheet will automatically
 * close itself on successful submission (if redirect is false) or when the Close button is clicked.
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * return (
 *   <>
 *     <Button onClick={() => setOpen(true)}>Create Contact</Button>
 *     <CreateSheet
 *       resource="contacts"
 *       title="Create Contact"
 *       open={open}
 *       onOpenChange={setOpen}
 *     >
 *       <TextInput source="first_name" />
 *       <TextInput source="last_name" />
 *       <TextInput source="email" />
 *     </CreateSheet>
 *   </>
 * );
 * ```
 */
export const CreateSheet = ({
  children,
  open,
  onOpenChange,
  title = "Create",
  redirect: redirectTo = "show",
  mutationOptions,
  defaultValues,
  ...createBaseProps
}: CreateSheetProps) => {
  const resource = useResourceContext(createBaseProps);
  const translate = useTranslate();
  const notify = useNotify();
  const redirect = useRedirect();

  // Handle success - close sheet in addition to default behavior
  const handleSuccess = (...args: any[]) => {
    if (mutationOptions?.onSuccess) {
      return mutationOptions.onSuccess(
        ...(args as Parameters<typeof mutationOptions.onSuccess>),
      );
    }
    const [data] = args;
    notify(`resources.${resource}.notifications.created`, {
      type: "info",
      messageArgs: {
        smart_count: 1,
        _: translate(`ra.notification.created`, {
          smart_count: 1,
        }),
      },
      undoable: createBaseProps.mutationMode === "undoable",
    });
    redirect(redirectTo, resource, data.id, data);
    onOpenChange(false);
  };

  const enhancedMutationOptions = {
    ...mutationOptions,
    onSuccess: handleSuccess,
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-dvh flex flex-col">
        <CreateBase
          {...createBaseProps}
          redirect={redirectTo}
          mutationOptions={enhancedMutationOptions}
        >
          <Form
            defaultValues={defaultValues}
            className="h-dvh flex-1 flex flex-col"
          >
            <SheetHeader className="border-b">
              <SheetTitle>
                {typeof title === "string" ? (
                  <span className="text-xl font-semibold">{title}</span>
                ) : (
                  title
                )}
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4">
              {children}
            </div>

            <SheetFooter className="border-t">
              <div className="flex w-full gap-4">
                <SheetClose asChild>
                  <Button variant="ghost" className="flex-1">
                    {translate("ra.action.close")}
                  </Button>
                </SheetClose>
                <SaveButton className="flex-1" />
              </div>
            </SheetFooter>
          </Form>
        </CreateBase>
      </SheetContent>
    </Sheet>
  );
};
