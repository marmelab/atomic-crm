import { useMutation } from "@tanstack/react-query";
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
import { NumberField } from "@/components/admin/number-field";
import { ReferenceField } from "@/components/admin/reference-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

import { NoteCreate } from "../notes/NoteCreate";
import { NotesIterator } from "../notes/NotesIterator";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { DealSalesCallSection } from "../sales-calls/DealSalesCallSection";
import type { Deal } from "../types";
import { DealApplicationAndEnrollment } from "./DealApplicationAndEnrollment";
import { OpenOfferPageAction } from "./OpenOfferPageAction";
import { ScholarshipPricingControl } from "./ScholarshipPricingControl";
import { findDealLabel } from "./dealUtils";
import {
  opportunityEntryPaths,
  opportunityOutcomes,
  opportunitySources,
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
              <h2 className="text-2xl font-semibold">
                <ReferenceField
                  source="contact_id"
                  reference="contacts"
                  link="show"
                />
              </h2>
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
                {translate("resources.deals.fields.offer_id")}
              </span>
              <span className="text-sm flex items-center gap-2">
                {record.offer_name_snapshot ?? (
                  <ReferenceField
                    source="offer_id"
                    reference="offers"
                    link={false}
                  />
                )}
                {record.pricing_mode === "scholarship" && (
                  <span className="text-xs font-medium text-primary rounded-full border px-2 py-0.5">
                    Scholarship
                  </span>
                )}
              </span>
            </div>

            {record.cohort_id && (
              <div className="flex flex-col mr-10">
                <span className="text-xs text-muted-foreground tracking-wide">
                  {translate("resources.deals.fields.cohort_id")}
                </span>
                <span className="text-sm">
                  <ReferenceField
                    source="cohort_id"
                    reference="cohorts"
                    link="show"
                  />
                </span>
              </div>
            )}

            <div className="flex flex-col mr-10">
              <span className="text-xs text-muted-foreground tracking-wide">
                {translate("resources.deals.fields.amount")}
              </span>
              {/* Production defect repair: deals.amount has no NOT NULL
                  constraint (a Deal created outside the normal
                  create/edit form's own amount-sync effect can genuinely
                  have no amount yet), but this raw .toLocaleString() call
                  had no null guard and crashed the whole lightbox with an
                  uncaught TypeError the moment such a Deal was opened —
                  found via a real Committed Opportunity with no amount
                  set. NumberField (already used identically on the
                  Kanban DealCard) renders nothing for a null value
                  instead of throwing — the same safe pattern, not a new
                  one. */}
              <NumberField
                source="amount"
                className="text-sm"
                options={{
                  notation: "compact",
                  style: "currency",
                  currency,
                  currencyDisplay: "narrowSymbol",
                  minimumSignificantDigits: 3,
                }}
              />
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

          {/* Human-acceptance repair pass, §Repair 1: Sales Call is now the
              most prominent operational content on this page — what
              happened on the call matters substantially more than the
              metadata below it (Source, Entry path). Placed right after
              the concise summary above, before that lower-priority
              metadata and well before Description/Notes, so its length
              (Judy Holloway's fixture Notes run very long) can never bury
              the action. */}
          <DealSalesCallSection />

          <div className="flex flex-wrap gap-8 m-4">
            <ScholarshipPricingControl />
            <OpenOfferPageAction />

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

            {record.selected_payment_total != null && (
              <div className="flex flex-col mr-10">
                <span className="text-xs text-muted-foreground tracking-wide">
                  {translate(
                    "resources.deals.fields.selected_payment_option_id",
                  )}
                </span>
                <span className="text-sm">
                  ${record.selected_payment_total} (
                  {record.selected_installment_count}× $
                  {record.selected_installment_amount})
                </span>
              </div>
            )}
          </div>

          <DealApplicationAndEnrollment />

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
