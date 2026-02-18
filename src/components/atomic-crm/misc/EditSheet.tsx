import { DeleteButton } from "@/components/admin";
import { SaveButton } from "@/components/admin/form";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  EditBase,
  Form,
  useNotify,
  useRedirect,
  useResourceContext,
  useTranslate,
  type EditBaseProps,
  type FormProps,
} from "ra-core";
import { type ReactNode } from "react";

export interface EditSheetProps extends EditBaseProps {
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

  /**
   * Custom delete button component. If not provided, defaults to the standard DeleteButton
   */
  deleteButton?: ReactNode;
}

/**
 * A Sheet component that contains an edit form with externally controlled open state.
 *
 * Renders a Sheet containing an EditBase form. The sheet has a fixed footer with Save and Delete buttons.
 * The open state is controlled externally via the open and onOpenChange props. The sheet will automatically
 * close itself on successful submission (if redirect is false) or when the Delete/Close actions are triggered.
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * return (
 *   <>
 *     <Button onClick={() => setOpen(true)}>Edit Contact</Button>
 *     <EditSheet
 *       resource="contacts"
 *       id={contactId}
 *       title="Edit Contact"
 *       open={open}
 *       onOpenChange={setOpen}
 *     >
 *       <TextInput source="first_name" />
 *       <TextInput source="last_name" />
 *       <TextInput source="email" />
 *     </EditSheet>
 *   </>
 * );
 * ```
 */
export const EditSheet = ({
  children,
  open,
  onOpenChange,
  title = "Edit",
  redirect: redirectTo = "show",
  mutationOptions,
  mutationMode = "undoable",
  defaultValues,
  deleteButton,
  ...editBaseProps
}: EditSheetProps) => {
  const resource = useResourceContext(editBaseProps);
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
    notify(`resources.${resource}.notifications.updated`, {
      type: "info",
      messageArgs: {
        smart_count: 1,
        _: translate(`ra.notification.updated`, {
          smart_count: 1,
        }),
      },
      undoable: mutationMode === "undoable",
    });
    redirect(redirectTo, resource, data.id, data);
    onOpenChange(false);
  };

  const enhancedMutationOptions = {
    ...mutationOptions,
    onSuccess: handleSuccess,
  };

  const defaultDeleteButton = (
    <DeleteButton variant="destructive" className="flex-1" />
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-dvh flex flex-col">
        <EditBase
          {...editBaseProps}
          redirect={redirectTo}
          mutationOptions={enhancedMutationOptions}
          mutationMode={mutationMode}
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
                {deleteButton || defaultDeleteButton}
                <SaveButton className="flex-1" />
              </div>
            </SheetFooter>
          </Form>
        </EditBase>
      </SheetContent>
    </Sheet>
  );
};
