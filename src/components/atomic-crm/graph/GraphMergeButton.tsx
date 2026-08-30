import { useState } from "react";
import { useNotify, useRedirect } from "ra-core";

import { Button } from "@/components/ui/button";
import { getStubCustomerId } from "../providers/local/principal";

interface GraphMergeButtonProps {
  loserId: string;
  firstName: string;
  lastName: string;
}

export function GraphMergeButton({
  loserId,
  firstName,
  lastName,
}: GraphMergeButtonProps) {
  const [winnerId, setWinnerId] = useState("");
  const [busy, setBusy] = useState(false);
  const notify = useNotify();
  const redirect = useRedirect();
  const apiBase = import.meta.env.VITE_CRM_API_URL ?? "http://127.0.0.1:8787";

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-sm">
        Merge into contact id
        <input
          className="mt-1 block w-80 border rounded px-2 py-1 font-mono text-xs"
          value={winnerId}
          onChange={(event) => setWinnerId(event.target.value.trim())}
          placeholder="uuid of the contact to keep"
        />
      </label>
      <Button
        variant="outline"
        disabled={busy || !winnerId || winnerId === loserId}
        onClick={async () => {
          try {
            setBusy(true);
            const res = await fetch(`${apiBase}/contacts/merge`, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-ardley-customer-id": getStubCustomerId(),
              },
              body: JSON.stringify({ loser_id: loserId, winner_id: winnerId }),
            });
            if (!res.ok) throw new Error(String(res.status));
            notify("Contacts merged", { type: "success" });
            redirect("show", "contacts", winnerId);
          } catch {
            notify("Merge failed", { type: "error" });
          } finally {
            setBusy(false);
          }
        }}
      >
        Merge {firstName} {lastName}
      </Button>
    </div>
  );
}
