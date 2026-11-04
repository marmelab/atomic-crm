import { useMutation } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  InfiniteListBase,
  ShowBase,
  useDataProvider,
  useLocaleState,
  useNotify,
  useRecordContext,
  useRedirect,
  useRefresh,
  useShowContext,
  useTranslate,
  useUpdate,
} from "ra-core";
import { DeleteButton } from "@/components/admin/delete-button";
import { EditButton } from "@/components/admin/edit-button";
import { ReferenceArrayField } from "@/components/admin/reference-array-field";
import { ReferenceField } from "@/components/admin/reference-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import {
  AdditionalInfo,
  CompanyInfo,
  ContextInfo,
} from "../companies/CompanyAside";
import { AsideSection } from "../misc/AsideSection";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import { formatLocalizedDate } from "../misc/RelativeDate";
import { NoteCreate } from "../notes/NoteCreate";
import { NotesIterator } from "../notes/NotesIterator";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company, Deal } from "../types";
import { ContactList } from "./ContactList";
import { findDealLabel } from "./dealUtils";

/** Full page of a deal (lead), with its company details beside it. */
export const DealShow = () => (
  <ShowBase>
    <DealShowContent />
  </ShowBase>
);

const DealShowContent = () => {
  const translate = useTranslate();
  const { record, isPending } = useShowContext<Deal>();
  if (isPending || !record) return null;

  return (
    <div className="mt-2 pb-4 flex flex-col gap-4">
      <Link
        to="/deals"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        {translate("resources.deals.action.back")}
      </Link>
      {record.archived_at ? <ArchivedTitle /> : null}
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-6">
              <DealHeader record={record} />
              <DealDetails record={record} />
              {!!record.contact_ids?.length && (
                <DealSection
                  title={translate("resources.deals.fields.contact_ids")}
                >
                  <ReferenceArrayField
                    source="contact_ids"
                    reference="contacts_summary"
                  >
                    <ContactList />
                  </ReferenceArrayField>
                </DealSection>
              )}
              {record.description && (
                <DealSection
                  title={translate("resources.deals.fields.description")}
                >
                  <p className="text-sm leading-6 whitespace-pre-line">
                    {record.description}
                  </p>
                </DealSection>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <DealSection
                title={translate("resources.notes.name", { smart_count: 2 })}
              >
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
              </DealSection>
            </CardContent>
          </Card>
        </div>
        {record.company_id != null && (
          <ReferenceField
            source="company_id"
            reference="companies"
            link={false}
          >
            <DealCompanyAside />
          </ReferenceField>
        )}
      </div>
    </div>
  );
};

const DealHeader = ({ record }: { record: Deal }) => {
  const { dealStages } = useConfigurationContext();
  return (
    <div className="flex flex-wrap justify-between items-start gap-4">
      <div className="flex items-center gap-4">
        <ReferenceField source="company_id" reference="companies" link="show">
          <CompanyAvatar />
        </ReferenceField>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{record.name}</h1>
          <Badge variant="secondary" className="w-fit">
            {findDealLabel(dealStages, record.stage)}
          </Badge>
        </div>
      </div>
      <div className="flex gap-2">
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
  );
};

const DealDetails = ({ record }: { record: Deal }) => {
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();
  const { currency } = useConfigurationContext();

  return (
    <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
      <DealField label={translate("resources.deals.fields.amount")}>
        {typeof record.amount === "number"
          ? record.amount.toLocaleString("en-US", {
              notation: "compact",
              style: "currency",
              currency,
              currencyDisplay: "narrowSymbol",
              minimumSignificantDigits: 3,
            })
          : "—"}
      </DealField>
      {record.created_at && (
        <DealField label={translate("resources.deals.fields.created_at")}>
          {formatLocalizedDate(record.created_at, locale)}
        </DealField>
      )}
      {record.updated_at && (
        <DealField label={translate("resources.deals.fields.updated_at")}>
          {formatLocalizedDate(record.updated_at, locale)}
        </DealField>
      )}
    </dl>
  );
};

const DealField = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-0.5">
    <dt className="text-xs text-muted-foreground tracking-wide">{label}</dt>
    <dd className="text-sm">{children}</dd>
  </div>
);

const DealSection = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-2">
    <h2 className="text-sm font-medium border-b pb-1">{title}</h2>
    {children}
  </section>
);

/** The lead details of the deal's company: vertical, place, pitch, contacts. */
const DealCompanyAside = () => {
  const company = useRecordContext<Company>();
  if (!company) return null;

  return (
    <aside className="w-full lg:w-92 lg:min-w-92">
      <Card>
        <CardContent>
          <Link
            to={`/companies/${company.id}/show`}
            className="flex items-center gap-3 mb-6 hover:underline"
          >
            <CompanyAvatar />
            <span className="text-lg font-semibold">{company.name}</span>
          </Link>
          <ContextInfo record={company} />
          <CompanyInfo record={company} />
          <DealPitch company={company} />
          <AdditionalInfo record={company} />
        </CardContent>
      </Card>
    </aside>
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

/** Always visible: the pitch script is what the caller needs on a lead. */
const DealPitch = ({ company }: { company: Company }) => {
  const translate = useTranslate();
  return (
    <AsideSection title={translate("resources.companies.fields.pitch_point")}>
      {company.pitch_point ? (
        <p className="text-sm whitespace-pre-line">{company.pitch_point}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {translate("resources.deals.pitch.empty")}{" "}
          <Link
            to={`/companies/${company.id}`}
            className="underline hover:no-underline text-foreground"
          >
            {translate("resources.deals.pitch.add")}
          </Link>
        </p>
      )}
    </AsideSection>
  );
};
