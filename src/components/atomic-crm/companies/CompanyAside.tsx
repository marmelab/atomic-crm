import {
  Globe,
  Linkedin,
  Mail,
  Phone,
  Calendar,
  Building2,
  Tag,
  Facebook,
  Instagram,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  useDataProvider,
  useGetIdentity,
  useLocaleState,
  useNotify,
  useRecordContext,
  useRefresh,
  useTranslate,
} from "ra-core";
import { useMutation } from "@tanstack/react-query";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { ShowButton } from "@/components/admin/show-button";
import { TextField } from "@/components/admin/text-field";
import { UrlField } from "@/components/admin/url-field";
import { SelectField } from "@/components/admin/select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { CrmDataProvider } from "../providers/supabase/dataProvider";

import { formatLocalizedDate } from "../misc/RelativeDate";
import { AsideSection } from "../misc/AsideSection";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company } from "../types";
import { getTranslatedCompanySizeLabel } from "./getTranslatedCompanySizeLabel";
import { sizes } from "./sizes";
import { useGetSalesName } from "../sales/useGetSalesName";
import {
  getFollowupRelativeLabel,
  getFollowupUrgency,
  getFollowupUrgencyColor,
  getNextActionTypeLabel,
} from "./followupUtils";
import { getLeadStatusColor } from "./leadStatusUtils";

interface CompanyAsideProps {
  link?: string;
}

export const CompanyAside = ({ link = "edit" }: CompanyAsideProps) => {
  const record = useRecordContext<Company>();
  const translate = useTranslate();
  if (!record) return null;

  return (
    <div className="hidden sm:block w-92 min-w-92 space-y-4">
      <div className="flex flex-row space-x-1">
        {link === "edit" ? (
          <EditButton label={translate("resources.companies.action.edit")} />
        ) : (
          <ShowButton label={translate("resources.companies.action.show")} />
        )}
      </div>

      <FollowUpSection record={record} />

      <CompanyInfo record={record} />

      <SwedishCrmInfo record={record} />

      <ImportInfo record={record} />

      <EnrichmentInfo record={record} />

      <AddressInfo record={record} />

      <ContextInfo record={record} />

      <AdditionalInfo record={record} />

      {link !== "edit" && (
        <div className="mt-6 pt-6 border-t hidden sm:flex flex-col gap-2">
          <DeleteButton
            label={translate("ra.action.delete")}
            variant="destructive"
            size="default"
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};

export const CompanyInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  if (
    !record.website &&
    !record.linkedin_url &&
    !record.phone_number &&
    !record.email
  ) {
    return null;
  }

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.contact")}
    >
      {record.website && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <Globe className="w-4 h-4" />
          <UrlField
            source="website"
            target="_blank"
            rel="noopener"
            content={record.website
              .replace("http://", "")
              .replace("https://", "")}
          />
        </div>
      )}
      {record.linkedin_url && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <Linkedin className="w-4 h-4" />
          <a
            className="underline hover:no-underline"
            href={record.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            title={record.linkedin_url}
          >
            LinkedIn
          </a>
        </div>
      )}
      {record.phone_number && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <Phone className="w-4 h-4" />
          <TextField source="phone_number" />
        </div>
      )}
      {record.email && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <Mail className="w-4 h-4" />
          <a
            className="underline hover:no-underline text-sm"
            href={`mailto:${record.email}`}
          >
            {record.email}
          </a>
        </div>
      )}
    </AsideSection>
  );
};

export const ContextInfo = ({ record }: { record: Company }) => {
  const { companySectors } = useConfigurationContext();
  const translate = useTranslate();
  if (!record.revenue && !record.id) {
    return null;
  }

  const sector = companySectors.find((s) => s.value === record.sector);
  const sectorLabel = sector?.label;
  const translatedSizes = sizes.map((size) => ({
    ...size,
    name: getTranslatedCompanySizeLabel(size, translate),
  }));

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.context")}
    >
      {sectorLabel && (
        <span>
          {translate("resources.companies.fields.sector")}: {sectorLabel}
        </span>
      )}
      {record.size && (
        <span>
          {translate("resources.companies.fields.size")}:{" "}
          <SelectField source="size" choices={translatedSizes} />
        </span>
      )}
      {record.revenue && (
        <span>
          {translate("resources.companies.fields.revenue")}:{" "}
          <TextField source="revenue" />
        </span>
      )}
      {record.tax_identifier && (
        <span>
          {translate("resources.companies.fields.tax_identifier", {})}
          : <TextField source="tax_identifier" />
        </span>
      )}
    </AsideSection>
  );
};

export const AddressInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  if (
    !record.address &&
    !record.city &&
    !record.zipcode &&
    !record.state_abbr
  ) {
    return null;
  }

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.address")}
      noGap
    >
      <TextField source="address" />
      <TextField source="city" />
      <TextField source="zipcode" />
      <TextField source="state_abbr" />
      <TextField source="country" />
    </AsideSection>
  );
};

export const SwedishCrmInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  const assignedToName = useGetSalesName(record.assigned_to, {
    enabled: !!record.assigned_to,
  });

  if (
    !record.lead_status &&
    !record.org_number &&
    !record.source &&
    !record.industry &&
    !record.assigned_to &&
    !record.tags?.length &&
    !record.employees_estimate
  ) {
    return null;
  }

  return (
    <AsideSection title="Lead Information">
      {record.lead_status && (
        <div className="flex items-center gap-2 mb-2">
          <Badge className={getLeadStatusColor(record.lead_status)}>
            {translate(
              `resources.companies.lead_status.${record.lead_status}`,
              {
                _: record.lead_status.replace(/_/g, " "),
              },
            )}
          </Badge>
        </div>
      )}
      {record.org_number && (
        <div className="text-sm mb-1">
          <span className="font-medium">Org.nr:</span> {record.org_number}
        </div>
      )}
      {record.industry && (
        <div className="flex items-center gap-1 text-sm mb-1">
          <Building2 className="w-4 h-4" />
          <span>{record.industry}</span>
        </div>
      )}
      {record.source && (
        <div className="text-sm mb-1">
          <span className="font-medium">Källa:</span>{" "}
          {translate(`resources.companies.source.${record.source}`, {
            _: record.source.replace(/_/g, " "),
          })}
        </div>
      )}
      {record.assigned_to && (
        <div className="text-sm mb-1">
          <span className="font-medium">Tilldelad:</span> {assignedToName}
        </div>
      )}
      {record.employees_estimate && (
        <div className="text-sm mb-1">
          <span className="font-medium">Anställda:</span> ~
          {record.employees_estimate}
        </div>
      )}
      {record.tags && record.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {record.tags.map((tag, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              <Tag className="w-3 h-3 mr-1" />
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </AsideSection>
  );
};

const PROSPECTING_STATUS_LABELS: Record<
  string,
  { label: string; color: string }
> = {
  imported: {
    label: "Importerad",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  enriching: {
    label: "Berikas...",
    color:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  },
  call_ready: {
    label: "Redo att ringa",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  needs_review: {
    label: "Behöver granskning",
    color:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  completed: {
    label: "Klar",
    color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  },
  disqualified: {
    label: "Diskvalificerad",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
};

const ImportInfo = ({ record }: { record: Company }) => {
  if (record.source !== "import" && record.source !== "google_maps")
    return null;

  const status = record.prospecting_status
    ? PROSPECTING_STATUS_LABELS[record.prospecting_status]
    : null;

  return (
    <AsideSection title="Import">
      {status && (
        <div className="flex items-center gap-2 mb-2">
          <Badge className={status.color}>{status.label}</Badge>
        </div>
      )}
      {record.source_row_number && (
        <div className="text-sm mb-1">
          <span className="font-medium">Rad i sheet:</span>{" "}
          {record.source_row_number}
        </div>
      )}
      {record.import_run_id && (
        <div className="text-sm mb-1">
          <span className="font-medium">Import-körning:</span> #
          {String(record.import_run_id)}
        </div>
      )}
    </AsideSection>
  );
};

const FollowUpSection = ({ record }: { record: Company }) => {
  const followupDate = record.next_followup_date;
  if (!followupDate && !record.next_action_type && !record.next_action_note) {
    return null;
  }

  const urgency = getFollowupUrgency(followupDate);
  const colorClass = urgency ? getFollowupUrgencyColor(urgency) : "";
  const relativeLabel = followupDate
    ? getFollowupRelativeLabel(followupDate)
    : null;

  return (
    <AsideSection title="Uppföljning">
      {followupDate && (
        <div className={`rounded-md p-2.5 -mx-1 ${colorClass}`}>
          <div className="flex items-center gap-1.5 font-medium">
            <Calendar className="w-4 h-4" />
            <span>{new Date(followupDate).toLocaleDateString("sv-SE")}</span>
          </div>
          {relativeLabel && (
            <div className="text-xs mt-0.5 opacity-80">{relativeLabel}</div>
          )}
        </div>
      )}
      {record.next_action_type && (
        <div className="text-sm mt-1">
          <span className="font-medium">Åtgärd:</span>{" "}
          {getNextActionTypeLabel(record.next_action_type)}
        </div>
      )}
      {record.next_action_note && (
        <div className="text-sm text-muted-foreground mt-1">
          {record.next_action_note}
        </div>
      )}
    </AsideSection>
  );
};

const getScoreColor = (score: number) => {
  if (score >= 60)
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  if (score >= 35)
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
  if (score >= 15)
    return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
  return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
};

const getSegmentLabel = (segment: string) => {
  const labels: Record<string, string> = {
    hot_lead: "Het lead",
    warm_lead: "Varm lead",
    cold_lead: "Kall lead",
    nurture: "Nurture",
    disqualified: "Diskvalificerad",
  };
  return labels[segment] || segment;
};

export const EnrichmentInfo = ({ record }: { record: Company }) => {
  const dataProvider = useDataProvider<CrmDataProvider>();
  const notify = useNotify();
  const refresh = useRefresh();

  const { mutate: enrich, isPending } = useMutation({
    mutationFn: () => dataProvider.enrichCompany(record.id),
    onSuccess: () => {
      notify("Företaget har berikats", { type: "success" });
      refresh();
    },
    onError: (error: Error) => {
      notify(`Berikning misslyckades: ${error.message}`, { type: "error" });
    },
  });

  const hasEnrichmentData =
    record.lead_score ||
    record.segment ||
    record.has_facebook ||
    record.has_instagram ||
    record.website_score != null;

  return (
    <AsideSection title="Enrichment & Scoring">
      {hasEnrichmentData && (
        <>
          {record.lead_score != null && (
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">Lead Score</span>
              </div>
              <Badge className={getScoreColor(record.lead_score)}>
                {record.lead_score}/100
              </Badge>
            </div>
          )}

          {record.segment && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Segment</span>
              <Badge variant="outline">{getSegmentLabel(record.segment)}</Badge>
            </div>
          )}

          {record.website_score != null && (
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">Webbplatskvalitet</span>
                <span className="text-xs text-muted-foreground">
                  {record.website_score}/100
                </span>
              </div>
              <Progress value={record.website_score} className="h-1.5" />
            </div>
          )}

          {(record.has_facebook || record.facebook_url) && (
            <div className="flex items-center gap-1.5 text-sm mb-1">
              <Facebook className="w-4 h-4 text-blue-600" />
              {record.facebook_url ? (
                <a
                  href={record.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:no-underline truncate"
                >
                  Facebook
                </a>
              ) : (
                <span>Facebook hittad</span>
              )}
            </div>
          )}

          {(record.has_instagram || record.instagram_url) && (
            <div className="flex items-center gap-1.5 text-sm mb-1">
              <Instagram className="w-4 h-4 text-pink-600" />
              {record.instagram_url ? (
                <a
                  href={record.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:no-underline truncate"
                >
                  Instagram
                </a>
              ) : (
                <span>Instagram hittad</span>
              )}
            </div>
          )}

          {record.enriched_at && (
            <p className="text-xs text-muted-foreground mt-2">
              Berikad:{" "}
              {new Date(record.enriched_at).toLocaleDateString("sv-SE")}
            </p>
          )}
        </>
      )}

      <Button
        variant="outline"
        size="sm"
        className="w-full mt-2"
        onClick={() => enrich()}
        disabled={isPending}
      >
        <Sparkles className="w-4 h-4 mr-1.5" />
        {isPending
          ? "Berikar..."
          : hasEnrichmentData
            ? "Berika igen"
            : "Berika företag"}
      </Button>
    </AsideSection>
  );
};

export const AdditionalInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();
  const { identity } = useGetIdentity();
  const isCurrentUser = record.sales_id === identity?.id;
  const salesName = useGetSalesName(record.sales_id, {
    enabled: !isCurrentUser,
  });
  if (
    !record.created_at &&
    !record.sales_id &&
    !record.description &&
    !record.context_links &&
    !record.google_business_url &&
    !record.website_quality
  ) {
    return null;
  }
  const getBaseURL = (url: string) => {
    const urlObject = new URL(url.startsWith("http") ? url : `https://${url}`);
    return urlObject.hostname;
  };

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.additional_info")}
    >
      {record.description && (
        <p className="text-sm  mb-1">{record.description}</p>
      )}
      {record.google_business_url && (
        <div className="mb-1">
          <a
            className="text-sm underline hover:no-underline"
            href={record.google_business_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Business Profile
          </a>
        </div>
      )}
      {record.website_quality && (
        <div className="text-sm mb-1">
          <span className="font-medium">Webbplatskvalitet:</span>{" "}
          {translate(
            `resources.companies.website_quality.${record.website_quality}`,
            {
              _: record.website_quality,
            },
          )}
        </div>
      )}
      {record.context_links && (
        <div className="flex flex-col">
          {record.context_links.map((link, index) => {
            if (!link) return null;
            const url =
              typeof link === "string" ? link : (link as { url: string }).url;
            const label =
              typeof link === "string"
                ? getBaseURL(link)
                : (link as { title?: string; source?: string }).source ||
                  getBaseURL(url);
            const href = url.startsWith("http") ? url : `https://${url}`;
            return (
              <a
                key={index}
                className="text-sm underline hover:no-underline mb-1"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                title={
                  typeof link === "string"
                    ? link
                    : (link as { title?: string }).title || url
                }
              >
                {label}
              </a>
            );
          })}
        </div>
      )}
      {record.sales_id !== null && (
        <div className="inline-flex text-sm text-muted-foreground mb-1">
          {translate(
            isCurrentUser
              ? "resources.companies.followed_by_you"
              : "resources.companies.followed_by",
            { name: salesName },
          )}
        </div>
      )}
      {record.created_at && (
        <p className="text-sm text-muted-foreground mb-1">
          {translate("resources.companies.added_on", {
            date: formatLocalizedDate(record.created_at, locale),
          })}{" "}
        </p>
      )}
    </AsideSection>
  );
};
