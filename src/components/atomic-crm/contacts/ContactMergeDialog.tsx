import { useState, useEffect } from "react";
import { Merge, CircleX } from "lucide-react";
import {
  useRecordContext,
  useGetList,
  useGetManyReference,
  required,
  Form,
  useNotify,
  useRedirect,
} from "ra-core";
import type { Identifier } from "ra-core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ReferenceInput } from "@/components/admin/reference-input";
import { AutocompleteInput } from "@/components/admin/autocomplete-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ArrowDown } from "lucide-react";
import type { Contact } from "../types";
import { contactOptionText } from "../misc/ContactOption";
import { useContactMerge } from "./useContactMerge";

interface ContactMergeDialogProps {
  open: boolean;
  onClose: () => void;
}

export const ContactMergeDialog = ({
  open,
  onClose,
}: ContactMergeDialogProps) => {
  const loserContact = useRecordContext<Contact>();
  const notify = useNotify();
  const redirect = useRedirect();
  const [winnerId, setWinnerId] = useState<Identifier | null>(null);
  const [suggestedWinnerId, setSuggestedWinnerId] = useState<Identifier | null>(
    null,
  );

  const { mergeContacts, isMerging } = useContactMerge();

  // Find potential contacts with matching first and last name
  const { data: matchingContacts } = useGetList(
    "contacts",
    {
      filter: {
        first_name: loserContact?.first_name,
        last_name: loserContact?.last_name,
        "id@neq": loserContact?.id, // Exclude current contact
      },
      pagination: { page: 1, perPage: 10 },
    },
    { enabled: open && !!loserContact },
  );

  // Get counts of items to be merged
  const canFetchCounts = open && !!loserContact && !!winnerId;
  const { total: tasksCount } = useGetManyReference(
    "tasks",
    {
      target: "contact_id",
      id: loserContact?.id,
      pagination: { page: 1, perPage: 1 },
    },
    { enabled: canFetchCounts },
  );

  const { total: notesCount } = useGetManyReference(
    "contactNotes",
    {
      target: "contact_id",
      id: loserContact?.id,
      pagination: { page: 1, perPage: 1 },
    },
    { enabled: canFetchCounts },
  );

  const { total: dealsCount } = useGetList(
    "deals",
    {
      filter: { "contact_ids@cs": `{${loserContact?.id}}` },
      pagination: { page: 1, perPage: 1 },
    },
    { enabled: canFetchCounts },
  );

  useEffect(() => {
    if (matchingContacts && matchingContacts.length > 0) {
      const suggestedWinnerId = matchingContacts[0].id;
      setSuggestedWinnerId(suggestedWinnerId);
      setWinnerId(suggestedWinnerId);
    }
  }, [matchingContacts]);

  const handleMerge = async () => {
    if (!winnerId || !loserContact) {
      notify("Please select a contact to merge with", { type: "warning" });
      return;
    }

    try {
      await mergeContacts(loserContact.id, winnerId);
      notify("Contacts merged successfully", { type: "success" });
      redirect(`/contacts/${winnerId}/show`);
      onClose();
    } catch (error) {
      notify("Failed to merge contacts", { type: "error" });
      console.error("Merge failed:", error);
    }
  };

  if (!loserContact) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="md:min-w-lg max-w-2xl">
        <DialogHeader>
          <DialogTitle>Merge Contact</DialogTitle>
          <DialogDescription>
            Merge this contact with another one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <p className="font-medium text-sm">
              Current Contact (will be deleted)
            </p>
            <div className="font-medium text-sm mt-4">{contactOptionText}</div>

            <div className="flex justify-center my-4">
              <ArrowDown className="h-5 w-5 text-muted-foreground" />
            </div>

            <p className="font-medium text-sm mb-2">
              Target Contact (will be kept)
            </p>
            <Form>
              <ReferenceInput
                source="winner_id"
                reference="contacts"
                filter={{ id_neq: loserContact.id }}
              >
                <AutocompleteInput
                  label=""
                  optionText={contactOptionText}
                  validate={required()}
                  onChange={setWinnerId}
                  defaultValue={suggestedWinnerId}
                  helperText={false}
                />
              </ReferenceInput>
            </Form>
          </div>

          {winnerId && (
            <>
              <div className="space-y-2">
                <p className="font-medium text-sm">What will be merged:</p>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  {notesCount != null && notesCount > 0 && (
                    <li>
                      • {notesCount} note
                      {notesCount !== 1 ? "s" : ""} will be reassigned
                    </li>
                  )}
                  {tasksCount != null && tasksCount > 0 && (
                    <li>
                      • {tasksCount} task
                      {tasksCount !== 1 ? "s" : ""} will be reassigned
                    </li>
                  )}
                  {dealsCount != null && dealsCount > 0 && (
                    <li>
                      • {dealsCount} deal
                      {dealsCount !== 1 ? "s" : ""} will be updated
                    </li>
                  )}
                  {loserContact.email_jsonb?.length > 0 && (
                    <li>
                      • {loserContact.email_jsonb.length} email address
                      {loserContact.email_jsonb.length !== 1 ? "es" : ""} will
                      be added
                    </li>
                  )}
                  {loserContact.phone_jsonb?.length > 0 && (
                    <li>
                      • {loserContact.phone_jsonb.length} phone number
                      {loserContact.phone_jsonb.length !== 1 ? "s" : ""} will be
                      added
                    </li>
                  )}
                  {!notesCount &&
                    !tasksCount &&
                    !dealsCount &&
                    !loserContact.email_jsonb?.length &&
                    !loserContact.phone_jsonb?.length && (
                      <li className="text-muted-foreground/60">
                        No additional data to merge
                      </li>
                    )}
                </ul>
              </div>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning: Destructive Operation</AlertTitle>
                <AlertDescription>
                  All data will be transferred to the second contact. This
                  action cannot be undone.
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isMerging}>
            <CircleX />
            Cancel
          </Button>
          <Button onClick={handleMerge} disabled={!winnerId || isMerging}>
            <Merge />
            {isMerging ? "Merging..." : "Merge Contacts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
