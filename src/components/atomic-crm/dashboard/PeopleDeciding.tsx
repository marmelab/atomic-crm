import { useGetList, useGetMany, useTranslate } from "ra-core";

import {
  DECIDING_STAGE,
  hasStatedDeciding,
  isPersonDeciding,
} from "../deals/peopleDeciding";
import { formatISODateString } from "../deals/dealUtils";
import { PersonCard } from "../misc/ProgramLayout";
import type { Contact, Deal } from "../types";

// Not "Hot Contacts" — just "who is currently deciding and may require my
// attention", using real Opportunity data. Kept compact on purpose so it
// doesn't compete visually with Tasks.
export const PeopleDeciding = () => {
  const translate = useTranslate();
  // The same population the Pipeline's Decision column shows. Filtering on
  // prospect_decision here is what made the Dashboard disagree with the
  // Pipeline — that field is set on one Opportunity out of 120, so the
  // Dashboard reported nobody deciding while 8 people were.
  const { data: deals, isPending: isPendingDeals } = useGetList<Deal>("deals", {
    // Stage only. The archived/outcome half of "active" is applied by
    // isPersonDeciding below rather than in the query: an "is null"
    // operator has to survive the provider's filter translation, and when
    // it does not the whole list comes back empty — which is exactly how
    // this said "Nobody is currently deciding" while the Pipeline showed
    // eight people. Decision-stage Opportunities number in the single
    // digits, so filtering the rest in memory costs nothing and cannot
    // silently return zero.
    filter: { stage: DECIDING_STAGE },
    pagination: { page: 1, perPage: 50 },
    sort: { field: "follow_up_date", order: "ASC" },
  });

  const people = (deals ?? []).filter(isPersonDeciding);
  const contactIds = [...new Set(people.map((deal) => deal.contact_id))];
  const { data: contacts, isPending: isPendingContacts } = useGetMany<Contact>(
    "contacts",
    { ids: contactIds },
    { enabled: contactIds.length > 0 },
  );

  if (isPendingDeals || (contactIds.length > 0 && isPendingContacts)) {
    return null;
  }

  const contactById = new Map(
    (contacts ?? []).map((contact) => [String(contact.id), contact]),
  );

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
        <div className="flex flex-col gap-2">
          {people.map((deal) => {
            const contact = contactById.get(String(deal.contact_id));
            const name = contact
              ? `${contact.first_name} ${contact.last_name}`
              : deal.name;
            return (
              <PersonCard
                key={deal.id}
                contactId={deal.contact_id}
                to={`/deals/${deal.id}/show`}
                name={name}
                meta={
                  <>
                    {deal.offer_name_snapshot}
                    {hasStatedDeciding(deal) &&
                      ` · ${translate("crm.dashboard.said_thinking", {
                        _: "said they are thinking it over",
                      })}`}
                    {deal.follow_up_date &&
                      ` · ${translate("crm.dashboard.follow_up_on", {
                        _: "follow up %{date}",
                        date: formatISODateString(deal.follow_up_date),
                      })}`}
                    {deal.description ? ` · ${deal.description}` : ""}
                  </>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
