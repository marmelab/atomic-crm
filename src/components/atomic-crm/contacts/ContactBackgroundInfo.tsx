import {
  useGetIdentity,
  useLocaleState,
  useRecordContext,
  useTranslate,
  WithRecord,
} from "ra-core";
import { TextField } from "@/components/admin/text-field";
import { formatLocalizedDate } from "../misc/RelativeDate";
import { useGetSalesName } from "../sales/useGetSalesName";
import type { Contact } from "../types";

export const ContactBackgroundInfo = () => {
  const record = useRecordContext<Contact>();
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();
  const { identity } = useGetIdentity();
  const isCurrentUser = record?.sales_id === identity?.id;
  const salesName = useGetSalesName(record?.sales_id, {
    enabled: !isCurrentUser,
  });

  if (!record) return null;

  const formattedLastSeen = record.last_seen
    ? formatLocalizedDate(record.last_seen, locale)
    : "";
  const formattedFirstSeen = formatLocalizedDate(record.first_seen, locale);

  return (
    <div>
      <WithRecord<Contact>
        render={(record) =>
          record?.background ? (
            <div className="pb-2 text-sm">
              <TextField source="background" record={record} />
            </div>
          ) : null
        }
      />
      <div className="text-muted-foreground md:py-0.5">
        <span className="text-sm">
          {translate("resources.contacts.background.added_on", {
            date: formattedFirstSeen,
          })}
        </span>{" "}
      </div>

      <div className="text-muted-foreground md:py-0.5">
        <span className="text-sm">
          {translate("resources.contacts.background.last_activity_on", {
            date: formattedLastSeen,
          })}
        </span>
      </div>

      <div className="inline-flex text-muted-foreground text-sm md:py-0.5">
        {translate(
          isCurrentUser
            ? "resources.contacts.background.followed_by_you"
            : "resources.contacts.background.followed_by",
          { name: salesName },
        )}
      </div>
    </div>
  );
};
