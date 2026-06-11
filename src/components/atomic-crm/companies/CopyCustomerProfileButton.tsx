import { Button } from "@/components/ui/button";
import { ClipboardCopy, Loader2 } from "lucide-react";
import { useState } from "react";
import { useDataProvider, useNotify, useRecordContext } from "ra-core";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type {
  CallLog,
  Company,
  Contact,
  ContactNote,
  Deal,
  DealNote,
  Quote,
  Task,
} from "../types";
import { buildCustomerProfile } from "./buildCustomerProfile";

/**
 * Copies a full customer profile (company, contacts, call logs, deals,
 * quotes, notes, tasks) as markdown to the clipboard — meant to be pasted
 * into Claude Desktop for meeting preparation. Data is fetched on click.
 */
export const CopyCustomerProfileButton = () => {
  const record = useRecordContext<Company>();
  const dataProvider = useDataProvider();
  const notify = useNotify();
  const { dealStages } = useConfigurationContext();
  const [loading, setLoading] = useState(false);

  if (!record) return null;

  const handleCopy = async () => {
    setLoading(true);
    try {
      const listParams = {
        pagination: { page: 1, perPage: 100 },
        sort: { field: "created_at", order: "DESC" as const },
        filter: { company_id: record.id },
      };

      const [contacts, callLogs, deals, quotes] = await Promise.all([
        dataProvider.getList<Contact>("contacts_summary", {
          ...listParams,
          sort: { field: "last_seen", order: "DESC" },
        }),
        dataProvider.getList<CallLog>("call_logs", listParams),
        dataProvider.getList<Deal>("deals", listParams),
        dataProvider.getList<Quote>("quotes", listParams),
      ]);

      const contactIds = contacts.data.map((c) => c.id);
      const dealIds = deals.data.map((d) => d.id);

      const [contactNotes, dealNotes, tasks] = await Promise.all([
        contactIds.length
          ? dataProvider.getList<ContactNote>("contact_notes", {
              pagination: { page: 1, perPage: 100 },
              sort: { field: "date", order: "DESC" },
              filter: { "contact_id@in": `(${contactIds.join(",")})` },
            })
          : Promise.resolve({ data: [] as ContactNote[] }),
        dealIds.length
          ? dataProvider.getList<DealNote>("deal_notes", {
              pagination: { page: 1, perPage: 100 },
              sort: { field: "date", order: "DESC" },
              filter: { "deal_id@in": `(${dealIds.join(",")})` },
            })
          : Promise.resolve({ data: [] as DealNote[] }),
        contactIds.length
          ? dataProvider.getList<Task>("tasks", {
              pagination: { page: 1, perPage: 100 },
              sort: { field: "due_date", order: "DESC" },
              filter: { "contact_id@in": `(${contactIds.join(",")})` },
            })
          : Promise.resolve({ data: [] as Task[] }),
      ]);

      const markdown = buildCustomerProfile({
        company: record,
        contacts: contacts.data,
        callLogs: callLogs.data,
        deals: deals.data,
        quotes: quotes.data,
        contactNotes: contactNotes.data,
        dealNotes: dealNotes.data,
        tasks: tasks.data,
        dealStages,
      });

      await navigator.clipboard.writeText(markdown);
      notify("Kundbild kopierad — klistra in i Claude Desktop", {
        type: "info",
      });
    } catch (error) {
      console.error("Could not copy customer profile:", error);
      notify("Kunde inte kopiera kundbilden", { type: "warning" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} disabled={loading}>
      {loading ? (
        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
      ) : (
        <ClipboardCopy className="w-4 h-4 mr-1" />
      )}
      Kundbild
    </Button>
  );
};
