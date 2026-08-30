import { Link } from "react-router";
import { useGetList, useTranslate } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";

import { isPersonDeciding } from "../deals/peopleDeciding";
import { formatISODateString } from "../deals/dealUtils";
import type { Deal } from "../types";

// Not "Hot Contacts" — just "who is currently deciding and may require my
// attention", using real Opportunity data. Kept compact on purpose so it
// doesn't compete visually with Tasks.
export const PeopleDeciding = () => {
  const translate = useTranslate();
  const { data: deals, isPending } = useGetList<Deal>("deals", {
    filter: { prospect_decision: "thinking" },
    pagination: { page: 1, perPage: 50 },
    sort: { field: "follow_up_date", order: "ASC" },
  });

  const people = (deals ?? []).filter(isPersonDeciding);

  if (isPending) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">
        {translate("crm.dashboard.people_deciding_title", {
          _: "People Deciding",
        })}
      </h2>
      <p className="text-sm text-muted-foreground mb-1">
        {translate("crm.dashboard.people_deciding_orientation", {
          _: "Who is currently deciding and may need your attention.",
        })}
      </p>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {translate("crm.dashboard.people_deciding_empty", {
            _: "Nobody is currently deciding.",
          })}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {people.map((deal) => (
            <li key={deal.id} className="text-sm">
              <Link
                to={`/deals/${deal.id}/show`}
                className="underline hover:no-underline font-medium"
              >
                <ReferenceField
                  source="contact_id"
                  reference="contacts"
                  record={deal}
                  link={false}
                />
              </Link>
              <span className="text-muted-foreground">
                {" "}
                · {deal.offer_name_snapshot}
                {deal.follow_up_date &&
                  ` · ${translate("crm.dashboard.follow_up_on", {
                    _: "follow up %{date}",
                    date: formatISODateString(deal.follow_up_date),
                  })}`}
              </span>
              {deal.description && (
                <p className="text-muted-foreground truncate">
                  {deal.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
