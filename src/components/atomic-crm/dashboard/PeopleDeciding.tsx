import { useGetList, useGetMany, useTranslate } from "ra-core";

import { isPersonDeciding } from "../deals/peopleDeciding";
import { formatISODateString } from "../deals/dealUtils";
import { PersonCard } from "../misc/ProgramLayout";
import type { Contact, Deal } from "../types";

// Not "Hot Contacts" — just "who is currently deciding and may require my
// attention", using real Opportunity data. Kept compact on purpose so it
// doesn't compete visually with Tasks.
export const PeopleDeciding = () => {
  const translate = useTranslate();
  const { data: deals, isPending: isPendingDeals } = useGetList<Deal>("deals", {
    filter: { prospect_decision: "thinking" },
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
