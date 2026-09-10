import { useTranslate } from "ra-core";
import { Link } from "react-router";
import { Card, CardContent } from "@/components/ui/card";

import { useOutstandingScholarshipReservations } from "./useOutstandingScholarshipReservations";

// Scholarship Pricing + Capacity slice: small, operational — see
// useOutstandingScholarshipReservations.ts's own header for why this is
// deliberately narrow, not a scholarship-management subsystem. Answers one
// question: "is an Offer's scholarship slot being held by an unpaid Deal
// right now, and by whom" — so a later grant attempt blocked by it is
// never a mystery.
export const OutstandingScholarshipReservations = () => {
  const translate = useTranslate();
  const { isPending, rows } = useOutstandingScholarshipReservations();

  if (isPending || rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-xl font-semibold">
        {translate("crm.dashboard.outstanding_scholarships_title", {
          _: "Outstanding Scholarship Reservations",
        })}
      </h2>
      <Card className="p-0">
        <CardContent className="p-0 divide-y">
          {rows.map((row) => (
            <Link
              key={row.dealId}
              to={`/deals/${row.dealId}/show`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors"
            >
              <span className="text-sm">
                {translate("crm.dashboard.outstanding_scholarship_row", {
                  _: "%{offer} scholarship reserved for %{name} — not yet paid",
                  offer: row.offerName,
                  name: row.contactName,
                })}
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
