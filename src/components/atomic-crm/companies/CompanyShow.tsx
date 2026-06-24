import { ReferenceManyField } from "@/components/admin/reference-many-field";
import { SortButton } from "@/components/admin/sort-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { UserPlus, FileText, Pencil } from "lucide-react";
import { useState } from "react";
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
import { getContactDisplayName } from "../contacts/contactName";
import { findDealLabel } from "../deals/dealUtils";
import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { MobileBackButton } from "../misc/MobileBackButton";
import { formatRelativeDate } from "../misc/RelativeDate";
import { Status } from "../misc/Status";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company, Contact, Deal, Quote } from "../types";
import {
  AdditionalInfo,
  AddressInfo,
  CompanyAside,
  CompanyInfo,
  ContextInfo,
} from "./CompanyAside";
import { CompanyAvatar } from "./CompanyAvatar";
import { CompanyEditSheet } from "./CompanyEditSheet";
import { CallLogModal } from "./CallLogModal";
import { CallLogHistory } from "./CallLogHistory";
import { CopyCustomerProfileButton } from "./CopyCustomerProfileButton";
import { CustomerDetailsTab, useIsCustomer } from "./CustomerDetailsTab";

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
  const navigate = useNavigate();
  const tabMatch = useMatch("/companies/:id/show/:tab");
  const currentTab = tabMatch?.params?.tab || "activity";
  const [editOpen, setEditOpen] = useState(false);
  const { total: nbQuotes = 0 } = useGetList<Quote>(
    "quotes",
    {
      pagination: { page: 1, perPage: 1 },
      filter: { company_id: record?.id },
    },
    { enabled: !!record?.id },
  );
  const isCustomer = useIsCustomer(record);

  if (isPending || !record) return null;

  const hasDeals = !!record.nb_deals;
  const hasQuotes = nbQuotes > 0;

  const handleTabChange = (value: string) => {
    if (value === currentTab) return;
    navigate(
      value === "activity"
        ? `/companies/${record.id}/show`
        : `/companies/${record.id}/show/${value}`,
    );
  };

  return (
    <>
      <CompanyEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        companyId={record.id}
      />
      <MobileHeader>
        <MobileBackButton resource="companies" />
        <div className="flex flex-1 min-w-0">
          <Link to="/companies" className="flex-1 min-w-0">
            <h1 className="truncate text-xl font-semibold">{record.name}</h1>
          </Link>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="size-5" />
          <span className="sr-only">{translate("ra.action.edit")}</span>
        </Button>
      </MobileHeader>

      <MobileContent>
        <div className="mb-4">
          <div className="flex items-center mb-4">
            <CompanyAvatar />
            <div className="mx-3 flex-1 min-w-0">
              <h2 className="text-2xl font-bold truncate">{record.name}</h2>
            </div>
            <CopyCustomerProfileButton />
            <CallLogModal />
          </div>
        </div>

        <Tabs
          value={currentTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList
            className={`grid w-full ${isCustomer ? "grid-cols-4" : "grid-cols-3"} h-10`}
          >
            <TabsTrigger value="activity">
              {translate("crm.common.activity")}
            </TabsTrigger>
            <TabsTrigger value="contacts">
              {translate("resources.contacts.name", { smart_count: 2 })}
              {record.nb_contacts ? ` (${record.nb_contacts})` : ""}
            </TabsTrigger>
            <TabsTrigger value="info">
              {translate("crm.common.details")}
            </TabsTrigger>
            {isCustomer ? (
              <TabsTrigger value="customer">Kund</TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="activity" className="mt-2">
            <div className="space-y-4">
              <CallLogHistory />
              <ActivityLog companyId={record.id} context="company" />
            </div>
          </TabsContent>

          <TabsContent value="contacts" className="mt-2">
            {record.nb_contacts ? (
              <ReferenceManyField
                reference="contacts_summary"
                target="company_id"
                sort={{ field: "last_name", order: "ASC" }}
              >
                <ContactsIterator />
              </ReferenceManyField>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                {translate("resources.companies.no_contacts")}
              </div>
            )}
          </TabsContent>

          <TabsContent value="info" className="mt-2">
            <div className="space-y-4">
              <CompanyInfo record={record} />
              <AddressInfo record={record} />
              <ContextInfo record={record} />
              <AdditionalInfo record={record} />

              {hasDeals && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    {translate("resources.deals.name", { smart_count: 2 })}
                  </h3>
                  <ReferenceManyField
                    reference="deals"
                    target="company_id"
                    sort={{ field: "name", order: "ASC" }}
                  >
                    <DealsIterator />
                  </ReferenceManyField>
                </div>
              )}

              {hasQuotes && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    {translate("resources.quotes.name", {
                      smart_count: 2,
                      _: "Offerter",
                    })}
                  </h3>
                  <ReferenceManyField
                    reference="quotes"
                    target="company_id"
                    sort={{ field: "created_at", order: "DESC" }}
                  >
                    <QuotesIterator />
                  </ReferenceManyField>
                </div>
              )}
            </div>
          </TabsContent>

          {isCustomer ? (
            <TabsContent value="customer" className="mt-2">
              <CustomerDetailsTab />
            </TabsContent>
          ) : null}
        </Tabs>
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

  const { total: nbQuotes = 0 } = useGetList<Quote>(
    "quotes",
    {
      pagination: { page: 1, perPage: 1 },
      filter: { company_id: record?.id },
    },
    { enabled: !!record?.id },
  );
  const isCustomer = useIsCustomer(record);

  const handleTabChange = (value: string) => {
    if (value === currentTab) return;
    if (value === "activity") {
      navigate(`/companies/${record?.id}/show`);
      return;
    }
    navigate(`/companies/${record?.id}/show/${value}`);
  };

  if (isPending || !record) return null;

  const hasDeals = !!record.nb_deals;
  const hasQuotes = nbQuotes > 0;
  const tabCount =
    3 + (hasDeals ? 1 : 0) + (hasQuotes ? 1 : 0) + (isCustomer ? 1 : 0);
  const gridColsClass =
    { 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5", 6: "grid-cols-6" }[
      tabCount
    ] ?? "grid-cols-3";

  return (
    <div className="mt-2 flex pb-2 gap-8">
      <div className="flex-1">
        <Card>
          <CardContent>
            <div className="flex mb-3 items-center">
              <CompanyAvatar />
              <h5 className="text-xl ml-2 flex-1">{record.name}</h5>
              <CopyCustomerProfileButton />
              <CallLogModal />
            </div>
            <Tabs defaultValue={currentTab} onValueChange={handleTabChange}>
              <TabsList className={`grid w-full ${gridColsClass}`}>
                <TabsTrigger value="activity">
                  {translate("crm.common.activity")}
                </TabsTrigger>
                <TabsTrigger value="contacts">
                  {record.nb_contacts === 0
                    ? translate("resources.companies.no_contacts")
                    : translate("resources.companies.nb_contacts", {
                        smart_count: record.nb_contacts,
                      })}
                </TabsTrigger>
                {record.nb_deals ? (
                  <TabsTrigger value="deals">
                    {translate("resources.companies.nb_deals", {
                      smart_count: record.nb_deals,
                    })}
                  </TabsTrigger>
                ) : null}
                {nbQuotes ? (
                  <TabsTrigger value="quotes">
                    {translate("resources.quotes.name", {
                      smart_count: nbQuotes,
                      _: `${nbQuotes} Quotes`,
                    })}
                  </TabsTrigger>
                ) : null}
                {isCustomer ? (
                  <TabsTrigger value="customer">Kund</TabsTrigger>
                ) : null}
              </TabsList>
              <TabsContent value="activity" className="pt-2">
                <div className="space-y-4">
                  <CallLogHistory />
                  <ActivityLog companyId={record.id} context="company" />
                </div>
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
              <TabsContent value="quotes">
                {nbQuotes ? (
                  <ReferenceManyField
                    reference="quotes"
                    target="company_id"
                    sort={{ field: "created_at", order: "DESC" }}
                  >
                    <QuotesIterator />
                  </ReferenceManyField>
                ) : null}
              </TabsContent>
              {isCustomer ? (
                <TabsContent value="customer" className="pt-2">
                  <CustomerDetailsTab />
                </TabsContent>
              ) : null}
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
                  {getContactDisplayName(contact)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {contact.title}
                  {contact.nb_tasks
                    ? ` - ${translate("crm.common.task_count", {
                        smart_count: contact.nb_tasks,
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

const quoteStatusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  generated: "bg-blue-100 text-blue-800",
  sent: "bg-yellow-100 text-yellow-800",
  viewed: "bg-purple-100 text-purple-800",
  signed: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  expired: "bg-orange-100 text-orange-800",
};

const QuotesIterator = () => {
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();
  const { data: quotesList, error, isPending } = useListContext<Quote>();
  const { currency } = useConfigurationContext();
  if (isPending || error) return null;
  return (
    <div className="pt-0">
      {quotesList.map((quote) => (
        <div key={quote.id} className="p-0 text-sm">
          <RouterLink
            to={`/quotes/${quote.id}/show`}
            className="flex items-center justify-between hover:bg-muted py-2 px-4 transition-colors"
          >
            <div className="flex items-center gap-2 mr-3">
              <FileText className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{quote.title}</div>
              <div className="text-sm text-muted-foreground">
                {quote.quote_number ? `${quote.quote_number} — ` : ""}
                {quote.total_amount.toLocaleString(locale, {
                  style: "currency",
                  currency,
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={
                  quoteStatusColors[quote.status] ?? quoteStatusColors.draft
                }
              >
                {translate(`resources.quotes.status.${quote.status}`, {
                  _: quote.status,
                })}
              </Badge>
              <div className="text-sm text-muted-foreground">
                {formatRelativeDate(quote.created_at, locale)}
              </div>
            </div>
          </RouterLink>
        </div>
      ))}
    </div>
  );
};
