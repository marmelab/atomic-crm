import { Button } from "@/components/ui/button";
import { useGetList, useShowContext } from "ra-core";
import { Link } from "react-router";

import type { Supplier, Contact } from "../types";
import { buildContactCreatePath } from "./contactLinking";
import {
  getContactDisplayName,
  getContactPrimaryEmail,
  getContactPrimaryPhone,
} from "./contactRecord";

export const SupplierContactsSection = () => {
  const { record } = useShowContext<Supplier>();
  const { data: contacts, isPending } = useGetList<Contact>(
    "contacts",
    {
      filter: { "supplier_id@eq": String(record?.id ?? "") },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "updated_at", order: "DESC" },
    },
    { enabled: !!record?.id },
  );

  if (!record) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Referenti
        </h3>
        <Button asChild size="sm" variant="outline">
          <Link
            to={buildContactCreatePath({
              supplierId: String(record.id),
            })}
          >
            Nuovo referente
          </Link>
        </Button>
      </div>

      {isPending ? null : !contacts?.length ? (
        <p className="text-sm text-muted-foreground">
          Nessun referente associato a questo fornitore.
        </p>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="rounded-lg border px-3 py-3 text-sm"
            >
              <div className="space-y-1">
                <Link
                  to={`/contacts/${contact.id}/show`}
                  className="font-medium text-primary hover:underline"
                >
                  {getContactDisplayName(contact)}
                </Link>
                {contact.title ? (
                  <p className="text-muted-foreground">{contact.title}</p>
                ) : null}
                {[
                  getContactPrimaryEmail(contact),
                  getContactPrimaryPhone(contact),
                ]
                  .filter(Boolean)
                  .map((value) => (
                    <p key={value} className="text-muted-foreground">
                      {value}
                    </p>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
