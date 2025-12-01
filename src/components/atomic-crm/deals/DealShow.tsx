import { format, isValid } from "date-fns";
import { ShowBase, useRecordContext, useRedirect } from "ra-core";
import { Edit } from "lucide-react";
import { Link } from "react-router";

import { useIsMobile } from "@/hooks/use-mobile";
import { DeleteButton } from "@/components/admin/delete-button";
import { EditButton } from "@/components/admin/edit-button";
import { ReferenceArrayField } from "@/components/admin/reference-array-field";
import { ReferenceField } from "@/components/admin/reference-field";
import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CompanyAvatar } from "../companies/CompanyAvatar";
import { NoteCreate } from "../notes/NoteCreate";
import { NotesIterator } from "../notes/NotesIterator";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { ContactList } from "./ContactList";
import { findDealLabel } from "./deal";
import { ReferenceManyCount } from "../misc/ReferenceManyCount";
import { UnarchiveButton } from "./UnarchiveButton";
import { ArchiveButton } from "./ArchiveButton";

export const DealShow = ({ open, id }: { open: boolean; id?: string }) => {
  const redirect = useRedirect();
  const handleClose = () => {
    redirect("list", "deals");
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="lg:max-w-4xl p-4 overflow-y-auto max-h-9/10 top-1/20 translate-y-0">
        {id ? <DealShowPage id={id} /> : null}
      </DialogContent>
    </Dialog>
  );
};

export const DealShowPage = ({ id }: { id?: string }) => (
  <ShowBase id={id}>
    <DealShowContent />
  </ShowBase>
);

const DealShowContent = () => {
  const isMobile = useIsMobile();
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
                source="company_id"
                reference="companies"
                link="show"
              >
                <CompanyAvatar />
              </ReferenceField>
              <h2 className="text-2xl font-semibold">{record.name}</h2>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                asChild
              >
                <Link to={`/deals/${record.id}`}>
                  <span className="sr-only">Edit</span>
                  <Edit />
                </Link>
              </Button>
            </div>
            {isMobile ? null : (
              <div
                className={`flex gap-2 ${record.archived_at ? "" : "pr-12"}`}
              >
                {record.archived_at ? (
                  <>
                    <UnarchiveButton />
                    <DeleteButton />
                  </>
                ) : (
                  <>
                    <ArchiveButton />
                    <EditButton />
                  </>
                )}
              </div>
            )}
          </div>

          {isMobile ? (
            <Tabs defaultValue="notes">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="notes">
                  <ReferenceManyCount
                    reference="dealNotes"
                    target="deal_id"
                    render={(total) => (
                      <>
                        {total?.toString()} {total === 1 ? "note" : "notes"}
                      </>
                    )}
                  />
                </TabsTrigger>
                <TabsTrigger value="contacts">
                  <ReferenceArrayField
                    reference="contacts_summary"
                    source="contact_ids"
                    render={({ total }) => (
                      <>
                        {total?.toString()}{" "}
                        {total === 1 ? "contact" : "contacts"}
                      </>
                    )}
                  />
                </TabsTrigger>
                <TabsTrigger value="about">About</TabsTrigger>
              </TabsList>
              <TabsContent value="notes">
                <ReferenceManyField
                  target="deal_id"
                  reference="dealNotes"
                  sort={{ field: "date", order: "DESC" }}
                  empty={<NoteCreate reference={"deals"} />}
                >
                  <NotesIterator reference="deals" />
                </ReferenceManyField>
              </TabsContent>
              <TabsContent value="contacts">
                <ReferenceArrayField
                  source="contact_ids"
                  reference="contacts_summary"
                >
                  <ContactList />
                </ReferenceArrayField>
              </TabsContent>
              <TabsContent value="about">
                <DealDetails />
              </TabsContent>
            </Tabs>
          ) : (
            <>
              <DealDetails />
              {!!record.contact_ids?.length && (
                <div className="m-4">
                  <div className="flex flex-col min-h-12 mr-10">
                    <span className="text-xs text-muted-foreground tracking-wide">
                      Contacts
                    </span>
                    <ReferenceArrayField
                      source="contact_ids"
                      reference="contacts_summary"
                    >
                      <ContactList />
                    </ReferenceArrayField>
                  </div>
                </div>
              )}

              {record.description && (
                <div className="m-4 whitespace-pre-line">
                  <span className="text-xs text-muted-foreground tracking-wide">
                    Description
                  </span>
                  <p className="text-sm leading-6">{record.description}</p>
                </div>
              )}

              <div className="m-4">
                <Separator className="mb-4" />
                <ReferenceManyField
                  target="deal_id"
                  reference="dealNotes"
                  sort={{ field: "date", order: "DESC" }}
                  empty={<NoteCreate reference={"deals"} />}
                >
                  <NotesIterator reference="deals" />
                </ReferenceManyField>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

const DealDetails = () => {
  const { dealStages } = useConfigurationContext();
  const record = useRecordContext<Deal>();

  if (!record) return null;
  return (
    <div className="flex flex-col md:flex-row gap-4 md:gap-8 md:m-4">
      <div className="flex flex-col mr-10">
        <span className="text-xs text-muted-foreground tracking-wide">
          Expected closing date
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm">
            {isValid(new Date(record.expected_closing_date))
              ? format(new Date(record.expected_closing_date), "PP")
              : "Invalid date"}
          </span>
          {new Date(record.expected_closing_date) < new Date() ? (
            <Badge variant="destructive">Past</Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col mr-10">
        <span className="text-xs text-muted-foreground tracking-wide">
          Budget
        </span>
        <span className="text-sm">
          {record.amount.toLocaleString("en-US", {
            notation: "compact",
            style: "currency",
            currency: "USD",
            currencyDisplay: "narrowSymbol",
            minimumSignificantDigits: 3,
          })}
        </span>
      </div>

      {record.category && (
        <div className="flex flex-col mr-10">
          <span className="text-xs text-muted-foreground tracking-wide">
            Category
          </span>
          <span className="text-sm">{record.category}</span>
        </div>
      )}

      <div className="flex flex-col mr-10">
        <span className="text-xs text-muted-foreground tracking-wide">
          Stage
        </span>
        <span className="text-sm">
          {findDealLabel(dealStages, record.stage)}
        </span>
      </div>
    </div>
  );
};

const ArchivedTitle = () => (
  <div className="bg-orange-500 px-6 py-4">
    <h3 className="text-lg font-bold text-white">Archived Deal</h3>
  </div>
);
