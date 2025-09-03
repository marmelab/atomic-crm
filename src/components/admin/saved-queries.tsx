import { useListContext, useTranslate } from "ra-core";
import { ChangeEvent, FormEvent, ReactElement, useState } from "react";
import isEqual from "lodash/isEqual";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  extractValidSavedQueries,
  useSavedQueries,
} from "@/hooks/saved-queries";

export const AddSavedQueryDialog = ({
  open,
  onClose,
}: AddSavedQueryDialogProps): ReactElement => {
  const translate = useTranslate();
  const { resource, filterValues, displayedFilters, sort, perPage } =
    useListContext();

  const [savedQueries, setSavedQueries] = useSavedQueries(resource);

  // input state
  const [queryName, setQueryName] = useState("");
  const handleQueryNameChange = (
    event: ChangeEvent<HTMLInputElement>,
  ): void => {
    setQueryName(event.target.value);
  };

  const handleFormSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    addQuery();
  };

  const addQuery = (): void => {
    const newSavedQuery = {
      label: queryName,
      value: {
        filter: filterValues,
        sort,
        perPage,
        displayedFilters,
      },
    };
    const newSavedQueries = extractValidSavedQueries(savedQueries);
    setSavedQueries(newSavedQueries.concat(newSavedQuery));
    setQueryName("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {translate("ra.saved_queries.new_dialog_title", {
              _: "Save current query as",
            })}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              {translate("ra.saved_queries.query_name", {
                _: "Query name",
              })}
            </Label>
            <Input
              id="name"
              value={queryName}
              onChange={handleQueryNameChange}
              autoFocus
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {translate("ra.action.cancel")}
          </Button>
          <Button onClick={addQuery}>{translate("ra.action.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export interface AddSavedQueryDialogProps {
  open: boolean;
  onClose: () => void;
}

export const RemoveSavedQueryDialog = ({
  open,
  onClose,
}: RemoveSavedQueryDialogProps): ReactElement => {
  const translate = useTranslate();
  const { resource, filterValues, sort, perPage, displayedFilters } =
    useListContext();

  const [savedQueries, setSavedQueries] = useSavedQueries(resource);

  const removeQuery = (): void => {
    const savedQueryToRemove = {
      filter: filterValues,
      sort,
      perPage,
      displayedFilters,
    };

    const newSavedQueries = extractValidSavedQueries(savedQueries);
    const index = newSavedQueries.findIndex((savedFilter) =>
      isEqual(savedFilter.value, savedQueryToRemove),
    );
    setSavedQueries([
      ...newSavedQueries.slice(0, index),
      ...newSavedQueries.slice(index + 1),
    ]);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {translate("ra.saved_queries.remove_dialog_title", {
              _: "Remove saved query?",
            })}
          </DialogTitle>
          <DialogDescription>
            {translate("ra.saved_queries.remove_message", {
              _: "Are you sure you want to remove that item from your list of saved queries?",
            })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {translate("ra.action.cancel")}
          </Button>
          <Button onClick={removeQuery} autoFocus>
            {translate("ra.action.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export interface RemoveSavedQueryDialogProps {
  open: boolean;
  onClose: () => void;
}
