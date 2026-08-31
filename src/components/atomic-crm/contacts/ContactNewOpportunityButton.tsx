import { Plus } from "lucide-react";
import { useTranslate, type Identifier } from "ra-core";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";

// The Contact page's "+ New Opportunity" fallback (Human-acceptance repair
// pass, §3B) — shown only when the Contact has no active Waitlist Entry
// (ContactSalesAction.tsx decides that). Reuses the EXISTING Opportunity
// creation dialog (deals/DealCreate.tsx, reached via the /deals/create
// route) rather than a second create form; react-admin's own
// useRecordFromLocation (ra-core) picks up the `record` passed in router
// state and prefills the Person field, so Leif never re-searches for
// someone already on their own Contact page. Do Not Engage is never hidden
// here — the same guard OpportunityPersonInput.tsx already enforces (via
// doNotEngageGuard.ts) blocks the actual Save, exactly as it does from any
// other entry point into this same form.
export const ContactNewOpportunityButton = ({
  contactId,
}: {
  contactId: Identifier;
}) => {
  const translate = useTranslate();
  const navigate = useNavigate();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() =>
        navigate("/deals/create", {
          state: { record: { contact_id: contactId } },
        })
      }
    >
      <Plus className="size-4" />
      {translate("resources.deals.action.new", { _: "New Opportunity" })}
    </Button>
  );
};
