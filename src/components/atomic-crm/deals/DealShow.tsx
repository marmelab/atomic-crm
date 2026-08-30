import { useMutation } from "@tanstack/react-query";
import { isValid } from "date-fns";
import { Archive, ArchiveRestore } from "lucide-react";
import {
  InfiniteListBase,
  ShowBase,
  useDataProvider,
  useNotify,
  useRecordContext,
  useRedirect,
  useRefresh,
  useTranslate,
  useUpdate,
} from "ra-core";
import { DeleteButton } from "@/components/admin/delete-button";
import { EditButton } from "@/components/admin/edit-button";
import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

import { Avatar } from "../contacts/Avatar";
import { NoteCreate } from "../notes/NoteCreate";
import { NotesIterator } from "../notes/NotesIterator";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { findDealLabel, formatISODateString } from "./dealUtils";
import {
  offerLabels,
  opportunityEntryPaths,
  opportunityOutcomes,
  opportunitySources,
  ownerDecisions,
  prospectDecisions,
} from "./opportunityConstants";

export const DealShow = ({ open, id }: { open: boolean; id?: string }) => {
  const redirect = useRedirect();
  const handleClose = () => {
    redirect("list", "deals");
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="lg:max-w-4xl p-4 overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        {id ? (
          <ShowBase id={id}>
            <DealShowContent />
          </ShowBase>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

const findLabel = (
  choices: { value: string; label: string }[],
  value?: string | null,
) => choices.find((choice) => choice.value === value)?.label;

const DealShowContent = () => {
  const translate = useTranslate();
  const { dealStages, currency } = useConfigurationContext();
  const record = useRecordContext<Deal>();
  if (!record) return null;

  return (
    <>
      <div className="space-y-2">
        {record.archived_at ? <ArchivedTitle /> : null}
        <div className="flex-1">
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-center gap-4">
              <ReferenceField
                source="contact_id"
                reference="contacts"
                link="show"
              >
                <Avatar />
              </ReferenceField>
              <h2 className="text-2xl font-semibold">{record.name}</h2>
            </div>
            <div className={`flex gap-2 ${record.archived_at ? "" : "pr-12"}`}>
              {record.archived_at ? (
                <>
                  <UnarchiveButton record={record} />
                  <DeleteButton />
                </>
              ) : (
                <>
                  <ArchiveButton record={record} />
                  <EditButton />
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-8 m-4">
            <div className="flex flex-col mr-10">
              <span className="text-xs text-muted-foreground tracking-wide">
                {translate("resources.deals.fields.offer")}
              </span>
              <span className="text-sm">{offerLabels[record.offer]}</span>
            </div>

            <div className="flex flex-col mr-10">
              <span className="text-xs text-muted-foreground tracking-wide">
                {translate("resources.deals.fields.expected_closing_date")}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  {isValid(new Date(record.expected_closing_date))
                    ? formatISODateString(record.expected_closing_date)
                    : translate("resources.deals.invalid_date")}
                </span>
                {new Date(record.expected_closing_date) < new Date() ? (
                  <Badge variant="destructive">
                    {translate("crm.common.past")}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col mr-10">
              <span className="text-xs text-muted-foreground tracking-wide">
                {translate("resources.deals.fields.amount")}
              </span>
              <span className="text-sm">
                {record.amount.toLocaleString("en-US", {
                  notation: "compact",
                  style: "currency",
                  currency,
                  currencyDisplay: "narrowSymbol",
                  minimumSignificantDigits: 3,
                })}
              </span>
            </div>

            <div className="flex flex-col mr-10">
              <span className="text-xs text-muted-foreground tracking-wide">
                {translate("resources.deals.fields.stage")}
              </span>
              <span className="text-sm">
                {findDealLabel(dealStages, record.stage)}
              </span>
            </div>

            {record.outcome && (
              <div className="flex flex-col mr-10">
                <span className="text-xs text-muted-foreground tracking-wide">
                  {translate("resources.deals.fields.outcome")}
                </span>
                <span className="text-sm">
                  {findLabel(opportunityOutcomes, record.outcome)}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-8 m-4">
            {record.source && (
              <div className="flex flex-col mr-10">
                <span className="text-xs text-muted-foreground tracking-wide">
                  {translate("resources.deals.fields.source")}
                </span>
                <span className="text-sm">
                  {findLabel(opportunitySources, record.source)}
                </span>
              </div>
            )}

            {record.entry_path && (
              <div className="flex flex-col mr-10">
                <span className="text-xs text-muted-foreground tracking-wide">
                  {translate("resources.deals.fields.entry_path")}
                </span>
                <span className="text-sm">
                  {findLabel(opportunityEntryPaths, record.entry_path)}
                </span>
              </div>
            )}

            {record.owner_decision && (
              <div className="flex flex-col mr-10">
                <span className="text-xs text-muted-foreground tracking-wide">
                  {translate("resources.deals.fields.owner_decision")}
                </span>
                <span className="text-sm">
                  {findLabel(ownerDecisions, record.owner_decision)}
                </span>
              </div>
            )}

            {record.owner_decision === "would_work_with" &&
              record.prospect_decision && (
                <div className="flex flex-col mr-10">
                  <span className="text-xs text-muted-foreground tracking-wide">
                    {translate("resources.deals.fields.prospect_decision")}
                  </span>
                  <span className="text-sm">
                    {findLabel(prospectDecisions, record.prospect_decision)}
                  </span>
                </div>
              )}

            {record.prospect_decision === "thinking" &&
              record.follow_up_date && (
                <div className="flex flex-col mr-10">
                  <span className="text-xs text-muted-foreground tracking-wide">
                    {translate("resources.deals.fields.follow_up_date")}
                  </span>
                  <span className="text-sm">
                    {formatISODateString(record.follow_up_date)}
                  </span>
                </div>
              )}
          </div>

          {record.description && (
            <div className="m-4 whitespace-pre-line">
              <span className="text-xs text-muted-foreground tracking-wide">
                {translate("resources.deals.fields.description")}
              </span>
              <p className="text-sm leading-6">{record.description}</p>
            </div>
          )}

          <div className="m-4">
            <Separator className="mb-4" />
            <InfiniteListBase
              resource="deal_notes"
              filter={{ deal_id: record.id }}
              sort={{ field: "date", order: "DESC" }}
              perPage={25}
              disableSyncWithLocation
              storeKey={false}
              empty={<NoteCreate reference={"deals"} />}
            >
              <NotesIterator reference="deals" />
            </InfiniteListBase>
          </div>
        </div>
      </div>
    </>
  );
};

const ArchivedTitle = () => {
  const translate = useTranslate();
  return (
    <div className="bg-orange-500 px-6 py-4">
      <h3 className="text-lg font-bold text-white">
        {translate("resources.deals.archived.title")}
      </h3>
    </div>
  );
};

const ArchiveButton = ({ record }: { record: Deal }) => {
  const translate = useTranslate();
  const [update] = useUpdate();
  const redirect = useRedirect();
  const notify = useNotify();
  const refresh = useRefresh();
  const handleClick = () => {
    update(
      "deals",
      {
        id: record.id,
        data: { archived_at: new Date().toISOString() },
        previousData: record,
      },
      {
        onSuccess: () => {
          redirect("list", "deals");
          notify("resources.deals.archived.success", {
            type: "info",
            undoable: false,
          });
          refresh();
        },
        onError: () => {
          notify("resources.deals.archived.error", {
            type: "error",
          });
        },
      },
    );
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      variant="outline"
      className="flex items-center gap-2 h-9"
    >
      <Archive className="w-4 h-4" />
      {translate("resources.deals.archived.action")}
    </Button>
  );
};

const UnarchiveButton = ({ record }: { record: Deal }) => {
  const translate = useTranslate();
  const dataProvider = useDataProvider();
  const redirect = useRedirect();
  const notify = useNotify();
  const refresh = useRefresh();

  const { mutate } = useMutation({
    mutationFn: () => dataProvider.unarchiveDeal(record),
    onSuccess: () => {
      redirect("list", "deals");
      notify("resources.deals.unarchived.success", {
        type: "info",
        undoable: false,
      });
      refresh();
    },
    onError: () => {
      notify("resources.deals.unarchived.error", {
        type: "error",
      });
    },
  });

  const handleClick = () => {
    mutate();
  };

  return (
    <Button
      onClick={handleClick}
      size="sm"
      variant="outline"
      className="flex items-center gap-2 h-9"
    >
      <ArchiveRestore className="w-4 h-4" />
      {translate("resources.deals.unarchived.action")}
    </Button>
  );
};
