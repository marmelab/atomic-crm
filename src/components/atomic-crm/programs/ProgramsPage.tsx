import { useState } from "react";
import { useGetList, useTranslate } from "ra-core";
import { Plus } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

import { CohortCapacityCard } from "../dashboard/CohortCapacityCard";
import type { Cohort, Offer } from "../types";
import { IndividualProgramCard } from "./IndividualProgramCard";
import { NewProgramDialog } from "./NewProgramDialog";

// The user-facing "Programs" hub (§6 of the Programs + Opportunity UX
// slice): a unified view over the existing Offer/Cohort model, not a new
// database entity. 1:1 programs and group programs each get their own
// section; every card links to the real page behind it (the Living
// Example / individual program page, or the Cohort's own detail page —
// §11, nothing here duplicates that data).
export const ProgramsPage = () => {
  const translate = useTranslate();
  const [newProgramOpen, setNewProgramOpen] = useState(false);

  const { data: offers, isPending: offersPending } = useGetList<Offer>(
    "offers",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "name", order: "ASC" },
    },
  );
  const { data: cohorts, isPending: cohortsPending } = useGetList<Cohort>(
    "cohorts",
    {
      filter: { "status@neq": "completed" },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "program_start_at", order: "ASC" },
    },
  );

  if (offersPending || cohortsPending) return null;

  const individualOffers = (offers ?? []).filter(
    (offer) => offer.type === "individual" && offer.max_active_clients != null,
  );
  const groupOffers = (offers ?? []).filter((offer) => offer.type === "group");
  const cohortsByOffer = new Map<string, Cohort[]>();
  for (const cohort of cohorts ?? []) {
    const key = String(cohort.offer_id);
    cohortsByOffer.set(key, [...(cohortsByOffer.get(key) ?? []), cohort]);
  }

  return (
    <div className="flex flex-col gap-8 mt-1">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold">
            {translate("crm.programs.title", { _: "Programs" })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {translate("crm.programs.orientation", {
              _: "Your current and upcoming ways of working with clients.",
            })}
          </p>
        </div>
        <Button onClick={() => setNewProgramOpen(true)}>
          <Plus className="h-4 w-4" />
          {translate("crm.programs.new_program_action", {
            _: "New Program",
          })}
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">
          {translate("crm.programs.one_on_one_section", {
            _: "1:1 Programs",
          })}
        </h2>
        {individualOffers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {translate("crm.programs.no_individual_programs", {
              _: "No 1:1 programs yet.",
            })}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
            {individualOffers.map((offer) => (
              <IndividualProgramCard offer={offer} key={offer.id} />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">
          {translate("crm.programs.group_section", { _: "Group Programs" })}
        </h2>
        {groupOffers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {translate("crm.programs.no_group_programs", {
              _: "No group programs yet.",
            })}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {groupOffers.map((offer) => (
              <div key={offer.id} className="flex flex-col gap-2">
                <Link
                  to={`/programs/group/${offer.id}`}
                  className="text-base font-medium text-muted-foreground hover:underline w-fit"
                >
                  {offer.name}
                </Link>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                  {(cohortsByOffer.get(String(offer.id)) ?? []).map(
                    (cohort) => (
                      <CohortCapacityCard cohort={cohort} key={cohort.id} />
                    ),
                  )}
                  {(cohortsByOffer.get(String(offer.id)) ?? []).length ===
                    0 && (
                    <p className="text-sm text-muted-foreground">
                      {translate("crm.programs.no_active_cohorts", {
                        _: "No active cohorts.",
                      })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewProgramDialog
        open={newProgramOpen}
        onOpenChange={setNewProgramOpen}
      />
    </div>
  );
};

ProgramsPage.path = "/programs";
