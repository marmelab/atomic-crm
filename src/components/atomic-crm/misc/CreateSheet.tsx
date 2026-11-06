import { SaveButton } from "@/components/admin/form";
import { DrawerTitle } from "@/components/ui/drawer";
import {
  CreateBase,
  Form,
  useRedirect,
  useResourceContext,
  type CreateBaseProps,
  type FormProps,
} from "ra-core";
import { type ReactNode } from "react";
import { FormDrawer } from "./FormDrawer";

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

  /**
   * Optional actions to render in the sheet header, next to the title
   */
  headerActions?: ReactNode;
}

/**
 * A full-screen drawer that contains a create form with externally controlled open state.
 *
 * Renders a FormDrawer containing a CreateBase form. The sheet has a fixed footer with Save and Close buttons.
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
  headerActions,
  ...createBaseProps
}: CreateSheetProps) => {
  const resource = useResourceContext(createBaseProps);
  const redirect = useRedirect();

  // Handle success - close sheet in addition to default behavior
  const handleSuccess = (...args: any[]) => {
    if (mutationOptions?.onSuccess) {
      return mutationOptions.onSuccess(
        ...(args as Parameters<typeof mutationOptions.onSuccess>),
      );
    }
    const [data] = args;
    redirect(redirectTo, resource, data.id, data);
    onOpenChange(false);
  };

  const enhancedMutationOptions = {
    ...mutationOptions,
    onSuccess: handleSuccess,
  };

  return (
    <FormDrawer open={open} onOpenChange={onOpenChange}>
      <CreateBase
        {...createBaseProps}
        redirect={redirectTo}
        mutationOptions={enhancedMutationOptions}
      >
        <Form
          defaultValues={defaultValues}
          className="min-h-0 flex-1 flex flex-col"
        >
          <div className="box-content h-14 shrink-0 flex items-center pl-4 pr-13 border-b">
            <DrawerTitle className="min-w-0 flex-1 truncate">
              {typeof title === "string" ? (
                <span className="text-xl font-semibold">{title}</span>
              ) : (
                title
              )}
            </DrawerTitle>
            {headerActions && <div className="shrink-0">{headerActions}</div>}
          </div>

          {/* pb-4! overrides the bottom padding Base UI's VirtualKeyboardProvider
              adds to the focused field's scroller: measured while the drawer slides
              in, it grows the scroller and pushes the footer under the keyboard.
              FormDrawer already keeps the whole form above the keyboard.
              FIXME: remove once Base UI fixes https://github.com/mui/base-ui/issues/6025 */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-4 pb-4!">
            {children}
          </div>

          <div className="mt-auto border-t flex flex-row w-full gap-4 p-4">
            <SaveButton className="flex-1 h-12" />
          </div>
        </Form>
      </CreateBase>
    </FormDrawer>
  );
};
