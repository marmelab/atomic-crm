import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { SortButton } from "@/components/admin/sort-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus } from "lucide-react";
import {
  RecordContextProvider,
  ShowBase,
  useGetList,
  useListContext,
  useLocaleState,
  useRecordContext,
  useShowContext,
  useTranslate,
} from "ra-core";
import {
  Link,
  Link as RouterLink,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";

import { useIsMobile } from "@/hooks/use-mobile";
import { ActivityLog } from "../activity/ActivityLog";
import { Avatar } from "../contacts/Avatar";
import { TagsList } from "../contacts/TagsList";
import { findDealLabel } from "../deals/dealUtils";
import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { MobileBackButton } from "../misc/MobileBackButton";
import { formatRelativeDate } from "../misc/RelativeDate";
import { Status } from "../misc/Status";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company, ComplianceFiling, Contact, Deal } from "../types";
import { ComplianceStatusBadge } from "../compliance/ComplianceStatusBadge";
import { FILING_TYPE_LABELS } from "../compliance/filingTypes";
import { GenerateScheduleButton } from "../compliance/GenerateScheduleButton";
import { GenerateInvoiceButton } from "../time-billing/GenerateInvoiceButton";
import {
  AdditionalInfo,
  AddressInfo,
  CompanyAside,
  CompanyInfo,
  ContextInfo,
} from "./CompanyAside";
import { CompanyAvatar } from "./CompanyAvatar";

export const CompanyShow = () => {
  const isMobile = useIsMobile();

  return (
    <ShowBase>
      {isMobile ? <CompanyShowContentMobile /> : <CompanyShowContent />}
    </ShowBase>
  );
};

const CompanyShowContentMobile = () => {
  const translate = useTranslate();
  const { record, isPending } = useShowContext<Company>();
  if (isPending || !record) return null;

  return (
    <>
      <MobileHeader>
        <MobileBackButton to="/" />
        <div className="flex flex-1">
          <Link to="/">
            <h1 className="text-xl font-semibold">
              {translate("resources.companies.forcedCaseName")}
            </h1>
          </Link>
        </div>
      </MobileHeader>

      <MobileContent>
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <CompanyAvatar />
            <div className="mx-3 flex-1">
              <h2 className="text-2xl font-bold">{record.name}</h2>
            </div>
          </div>
        </div>
        <CompanyInfo record={record} />
        <AddressInfo record={record} />
        <ContextInfo record={record} />
        <AdditionalInfo record={record} />
      </MobileContent>
    </>
  );
};

const CompanyShowContent = () => {
  const translate = useTranslate();
  const { record, isPending } = useShowContext<Company>();
  const navigate = useNavigate();

  // Get tab from URL or default to "activity"
  const tabMatch = useMatch("/companies/:id/show/:tab");
  const currentTab = tabMatch?.params?.tab || "activity";

  const handleTabChange = (value: string) => {
    if (value === currentTab) return;
    if (value === "activity") {
      navigate(`/companies/${record?.id}/show`);
      return;
    }
    navigate(`/companies/${record?.id}/show/${value}`);
  };

  if (isPending || !record) return null;

  return (
    <div className="mt-2 flex pb-2 gap-8">
      <div className="flex-1">
        <Card>
          <CardContent>
            <div className="flex mb-3">
              <CompanyAvatar />
              <h5 className="text-xl ml-2 flex-1">{record.name}</h5>
            </div>
            <Tabs defaultValue={currentTab} onValueChange={handleTabChange}>
              <TabsList className="w-full">
                <TabsTrigger value="activity">
                  {translate("crm.common.activity")}
                </TabsTrigger>
                <TabsTrigger value="contacts">
                  {record.nb_contacts === 0
                    ? translate("resources.companies.no_contacts")
                    : translate("resources.companies.nb_contacts", {
                        smart_count: record.nb_contacts ?? 0,
                      })}
                </TabsTrigger>
                {record.nb_deals ? (
                  <TabsTrigger value="deals">
                    {translate("resources.companies.nb_deals", {
                      smart_count: record.nb_deals ?? 0,
                    })}
                  </TabsTrigger>
                ) : null}
                <TabsTrigger value="filings">
                  {translate("crm.compliance.tab_filings", { _: "Filings" })}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="activity" className="pt-2">
                <ActivityLog companyId={record.id} context="company" />
              </TabsContent>
              <TabsContent value="contacts">
                {record.nb_contacts ? (
                  <ReferenceManyField
                    reference="contacts_summary"
                    target="company_id"
                    sort={{ field: "last_name", order: "ASC" }}
                  >
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-row justify-end space-x-2 mt-1">
                        {!!record.nb_contacts && (
                          <SortButton
                            fields={["last_name", "first_name", "last_seen"]}
                          />
                        )}
                        <CreateRelatedContactButton />
                      </div>
                      <ContactsIterator />
                    </div>
                  </ReferenceManyField>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-row justify-end space-x-2 mt-1">
                      <CreateRelatedContactButton />
                    </div>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="deals">
                {record.nb_deals ? (
                  <ReferenceManyField
                    reference="deals"
                    target="company_id"
                    sort={{ field: "name", order: "ASC" }}
                  >
                    <DealsIterator />
                  </ReferenceManyField>
                ) : null}
              </TabsContent>
              <TabsContent value="filings" className="pt-2">
                <CompanyFilingsTab />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <CompanyAside />
    </div>
  );
};

const ContactsIterator = () => {
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();
  const location = useLocation();
  const { data: contacts, error, isPending } = useListContext<Contact>();

  if (isPending || error) return null;

  return (
    <div className="pt-0">
      {contacts.map((contact) => (
        <RecordContextProvider key={contact.id} value={contact}>
          <div className="p-0 text-sm">
            <RouterLink
              to={`/contacts/${contact.id}/show`}
              state={{ from: location.pathname }}
              className="flex items-center justify-between hover:bg-muted py-2 transition-colors"
            >
              <div className="mr-4">
                <Avatar />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium">
                  {`${contact.first_name} ${contact.last_name}`}
                </div>
                <div className="text-sm text-muted-foreground">
                  {contact.title}
                  {contact.nb_tasks
                    ? ` - ${translate("crm.common.task_count", {
                        smart_count: contact.nb_tasks ?? 0,
                      })}`
                    : ""}
                  &nbsp; &nbsp;
                  <TagsList />
                </div>
              </div>
              {contact.last_seen && (
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">
                    {translate("crm.common.last_activity_with_date", {
                      date: formatRelativeDate(contact.last_seen, locale),
                    })}{" "}
                    <Status status={contact.status} />
                  </div>
                </div>
              )}
            </RouterLink>
          </div>
        </RecordContextProvider>
      ))}
    </div>
  );
};

const CreateRelatedContactButton = () => {
  const translate = useTranslate();
  const company = useRecordContext<Company>();
  return (
    <Button variant="outline" asChild size="sm" className="h-9">
      <RouterLink
        to="/contacts/create"
        state={company ? { record: { company_id: company.id } } : undefined}
        className="flex items-center gap-2"
      >
        <UserPlus className="h-4 w-4" />
        {translate("resources.contacts.action.add")}
      </RouterLink>
    </Button>
  );
};

const CompanyFilingsTab = () => {
  const company = useRecordContext<Company>();
  const { data: filings = [], isPending } = useGetList<ComplianceFiling>(
    "compliance_filings",
    {
      filter: { company_id: company?.id },
      sort: { field: "due_date", order: "ASC" },
      pagination: { page: 1, perPage: 1000 },
    },
    { enabled: !!company?.id },
  );

  if (!company) return null;

  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex justify-end gap-2">
        <GenerateInvoiceButton />
        <GenerateScheduleButton />
      </div>
      {!isPending && filings.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No filings yet. Generate a schedule to get started.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Due Date</th>
                <th className="text-left p-2 font-medium">Filing</th>
                <th className="text-left p-2 font-medium">Period</th>
                <th className="text-left p-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filings.map((f) => (
                <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-2 whitespace-nowrap text-xs">
                    {new Date(f.due_date).toLocaleDateString("en-GB")}
                  </td>
                  <td className="p-2 text-xs">
                    {FILING_TYPE_LABELS[f.filing_type]}
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {f.period_covered}
                  </td>
                  <td className="p-2">
                    <ComplianceStatusBadge status={f.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const DealsIterator = () => {
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();
  const { data: deals, error, isPending } = useListContext<Deal>();
  const { dealStages, dealCategories, currency } = useConfigurationContext();
  if (isPending || error) return null;
  return (
    <div>
      <div>
        {deals.map((deal) => (
          <div key={deal.id} className="p-0 text-sm">
            <RouterLink
              to={`/deals/${deal.id}/show`}
              className="flex items-center justify-between hover:bg-muted py-2 px-4 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium">{deal.name}</div>
                <div className="text-sm text-muted-foreground">
                  {findDealLabel(dealStages, deal.stage)},{" "}
                  {deal.amount.toLocaleString("en-US", {
                    notation: "compact",
                    style: "currency",
                    currency,
                    currencyDisplay: "narrowSymbol",
                    minimumSignificantDigits: 3,
                  })}
                  {deal.category
                    ? `, ${dealCategories.find((c) => c.value === deal.category)?.label ?? deal.category}`
                    : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">
                  {translate("crm.common.last_activity_with_date", {
                    date: formatRelativeDate(deal.updated_at, locale),
                  })}{" "}
                </div>
              </div>
            </RouterLink>
          </div>
        ))}
      </div>
    </div>
  );
};
