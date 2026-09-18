import { useGetOne } from "ra-core";
import type { Identifier } from "ra-core";

import type { Contact } from "../types";

// Leif should never have to leave the screen he is working on to find
// somebody's email address.
//
// Renders the primary address as a mailto link wherever a person is being
// worked on operationally — the Opportunity drawer, the Client detail —
// with any alternates listed beneath.
//
// Two things it deliberately does not do. It never renders a
// `le-standalone:<notion-page-id>` key as an address: twenty-two Contacts
// carry one of those as their only "email" because the import had no real
// address for them, and presenting it as something clickable would be a
// lie with a mailto on it. And it renders nothing at all rather than an
// empty labelled section, so a Contact without an address costs no space.
const isRealAddress = (email: string | undefined): boolean =>
  Boolean(email) &&
  !email!.startsWith("le-standalone:") &&
  email!.includes("@");

export const PersonEmail = ({
  contactId,
  className,
}: {
  contactId: Identifier | undefined;
  className?: string;
}) => {
  const { data: contact } = useGetOne<Contact>(
    "contacts",
    { id: contactId as Identifier },
    { enabled: contactId != null },
  );

  const addresses = (contact?.email_jsonb ?? [])
    .map((entry) => entry.email)
    .filter(isRealAddress);

  if (addresses.length === 0) return null;

  const [primary, ...alternates] = addresses;

  return (
    <div className={className} data-testid="person-email">
      <a
        href={`mailto:${primary}`}
        className="text-sm underline hover:no-underline break-all"
        // The row this sits in is often itself a link; clicking the
        // address must send mail, not navigate.
        onClick={(event) => event.stopPropagation()}
      >
        {primary}
      </a>
      {alternates.length > 0 && (
        <div className="flex flex-col">
          {alternates.map((email) => (
            <a
              key={email}
              href={`mailto:${email}`}
              className="text-xs text-muted-foreground underline hover:no-underline break-all"
              onClick={(event) => event.stopPropagation()}
            >
              {email}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
